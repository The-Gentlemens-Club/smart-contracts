// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Tournament is ReentrancyGuard, Ownable {
    IERC20 public token;
    
    struct TournamentInfo {
        uint256 id;
        uint256 entryFee;
        uint256 prizePool;
        uint256 minPlayers;
        uint256 maxPlayers;
        uint256 startTime;
        uint256 endTime;
        uint256 minBet;
        uint256 maxBet;
        bool active;
        address[] players;
        mapping(address => bool) isRegistered;
        mapping(address => uint256) playerScores;
        address[] winners;
        TournamentStatus status;
    }

    enum TournamentStatus { 
        UPCOMING,
        ACTIVE,
        COMPLETED
    }

    mapping(uint256 => TournamentInfo) public tournaments;
    uint256 public tournamentCounter;

    event TournamentCreated(uint256 indexed id, uint256 entryFee, uint256 prizePool, uint256 startTime);
    event PlayerRegistered(uint256 indexed tournamentId, address indexed player);
    event TournamentStarted(uint256 indexed id);
    event TournamentEnded(uint256 indexed id, address[] winners);
    event ScoreUpdated(uint256 indexed tournamentId, address indexed player, uint256 newScore);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function createTournament(
        uint256 _entryFee,
        uint256 _prizePool,
        uint256 _minPlayers,
        uint256 _maxPlayers,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _minBet,
        uint256 _maxBet
    ) external onlyOwner {
        require(_startTime > block.timestamp, "Invalid start time");
        require(_endTime > _startTime, "Invalid end time");
        require(_minPlayers >= 2, "Min players must be at least 2");
        require(_maxPlayers >= _minPlayers, "Max players must be >= min players");
        require(_maxBet >= _minBet, "Max bet must be >= min bet");

        uint256 tournamentId = tournamentCounter++;
        TournamentInfo storage tournament = tournaments[tournamentId];
        
        tournament.id = tournamentId;
        tournament.entryFee = _entryFee;
        tournament.prizePool = _prizePool;
        tournament.minPlayers = _minPlayers;
        tournament.maxPlayers = _maxPlayers;
        tournament.startTime = _startTime;
        tournament.endTime = _endTime;
        tournament.minBet = _minBet;
        tournament.maxBet = _maxBet;
        tournament.active = false;
        tournament.status = TournamentStatus.UPCOMING;

        emit TournamentCreated(tournamentId, _entryFee, _prizePool, _startTime);
    }

    function registerForTournament(uint256 _tournamentId) external nonReentrant {
        TournamentInfo storage tournament = tournaments[_tournamentId];
        
        require(tournament.startTime > 0, "Tournament does not exist");
        require(!tournament.isRegistered[msg.sender], "Already registered");
        require(tournament.players.length < tournament.maxPlayers, "Tournament full");
        require(block.timestamp < tournament.startTime, "Tournament has already started");
        require(token.balanceOf(msg.sender) >= tournament.entryFee, "Insufficient token balance");
        require(token.allowance(msg.sender, address(this)) >= tournament.entryFee, "Token allowance too low");

        token.transferFrom(msg.sender, address(this), tournament.entryFee);
        
        tournament.players.push(msg.sender);
        tournament.isRegistered[msg.sender] = true;
        tournament.playerScores[msg.sender] = 0;

        emit PlayerRegistered(_tournamentId, msg.sender);

        if (tournament.players.length >= tournament.minPlayers && 
            block.timestamp >= tournament.startTime) {
            _startTournament(_tournamentId);
        }
    }

    function updatePlayerScore(uint256 _tournamentId, address _player, uint256 _score) external onlyOwner {
        TournamentInfo storage tournament = tournaments[_tournamentId];
        require(tournament.active, "Tournament not active");
        require(tournament.isRegistered[_player], "Player not registered");
        
        tournament.playerScores[_player] = _score;
        emit ScoreUpdated(_tournamentId, _player, _score);
    }

    function endTournament(uint256 _tournamentId, address[] calldata _winners) external onlyOwner {
        TournamentInfo storage tournament = tournaments[_tournamentId];
        require(tournament.active, "Tournament not active");
        require(block.timestamp >= tournament.endTime || 
                tournament.players.length == tournament.maxPlayers, 
                "Cannot end tournament yet");

        tournament.active = false;
        tournament.status = TournamentStatus.COMPLETED;
        tournament.winners = _winners;

        uint256 prizePerWinner = tournament.prizePool / _winners.length;
        for (uint256 i = 0; i < _winners.length; i++) {
            require(tournament.isRegistered[_winners[i]], "Invalid winner");
            token.transfer(_winners[i], prizePerWinner);
        }

        emit TournamentEnded(_tournamentId, _winners);
    }

    function _startTournament(uint256 _tournamentId) internal {
        TournamentInfo storage tournament = tournaments[_tournamentId];
        tournament.active = true;
        tournament.status = TournamentStatus.ACTIVE;
        emit TournamentStarted(_tournamentId);
    }

    // View functions
    function getTournamentPlayers(uint256 _tournamentId) external view returns (address[] memory) {
        return tournaments[_tournamentId].players;
    }

    function getPlayerScore(uint256 _tournamentId, address _player) external view returns (uint256) {
        return tournaments[_tournamentId].playerScores[_player];
    }

    function getTournamentWinners(uint256 _tournamentId) external view returns (address[] memory) {
        return tournaments[_tournamentId].winners;
    }

    function getTournamentStatus(uint256 _tournamentId) external view returns (TournamentStatus) {
        return tournaments[_tournamentId].status;
    }
} 