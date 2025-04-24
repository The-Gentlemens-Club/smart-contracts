// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Tournament.sol";

contract Game is ReentrancyGuard, Ownable {
    IERC20 public token;
    Tournament public tournament;

    struct GameInfo {
        uint256 id;
        uint256 tournamentId;
        address player;
        uint256 betAmount;
        uint256 timestamp;
        GameOutcome outcome;
        bool settled;
    }

    enum GameOutcome {
        WIN,
        LOSE,
        DRAW
    }

    mapping(uint256 => GameInfo) public games;
    uint256 public gameCounter;
    
    mapping(address => uint256[]) public playerGames;
    mapping(uint256 => mapping(address => uint256)) public tournamentPlayerGames;

    event GameStarted(uint256 indexed id, uint256 indexed tournamentId, address indexed player, uint256 betAmount);
    event GameSettled(uint256 indexed id, GameOutcome outcome, uint256 payout);

    constructor(address _token, address _tournament) Ownable(msg.sender) {
        token = IERC20(_token);
        tournament = Tournament(_tournament);
    }

    function startGame(uint256 _tournamentId, uint256 _betAmount) external nonReentrant returns (uint256) {
        require(tournament.getTournamentStatus(_tournamentId) == Tournament.TournamentStatus.ACTIVE, 
                "Tournament not active");
        
        // Validate bet amount against tournament limits
        (uint256 minBet, uint256 maxBet) = _getTournamentBetLimits(_tournamentId);
        require(_betAmount >= minBet && _betAmount <= maxBet, "Invalid bet amount");
        
        require(token.balanceOf(msg.sender) >= _betAmount, "Insufficient balance");
        require(token.allowance(msg.sender, address(this)) >= _betAmount, "Insufficient allowance");

        uint256 gameId = gameCounter++;
        GameInfo storage game = games[gameId];
        
        game.id = gameId;
        game.tournamentId = _tournamentId;
        game.player = msg.sender;
        game.betAmount = _betAmount;
        game.timestamp = block.timestamp;
        game.settled = false;

        token.transferFrom(msg.sender, address(this), _betAmount);
        
        playerGames[msg.sender].push(gameId);
        tournamentPlayerGames[_tournamentId][msg.sender]++;

        emit GameStarted(gameId, _tournamentId, msg.sender, _betAmount);
        return gameId;
    }

    function settleGame(uint256 _gameId, GameOutcome _outcome) external onlyOwner {
        GameInfo storage game = games[_gameId];
        require(!game.settled, "Game already settled");
        
        game.outcome = _outcome;
        game.settled = true;

        uint256 payout = 0;
        if (_outcome == GameOutcome.WIN) {
            payout = game.betAmount * 2;
            token.transfer(game.player, payout);
            tournament.updatePlayerScore(game.tournamentId, game.player, 
                tournamentPlayerGames[game.tournamentId][game.player]);
        } else if (_outcome == GameOutcome.DRAW) {
            payout = game.betAmount;
            token.transfer(game.player, payout);
        }

        emit GameSettled(_gameId, _outcome, payout);
    }

    function _getTournamentBetLimits(uint256 _tournamentId) internal view returns (uint256 minBet, uint256 maxBet) {
        // This would need to be implemented based on how the Tournament contract stores bet limits
        return (0, type(uint256).max); // Placeholder implementation
    }

    // View functions
    function getPlayerGames(address _player) external view returns (uint256[] memory) {
        return playerGames[_player];
    }

    function getGameInfo(uint256 _gameId) external view returns (
        uint256 id,
        uint256 tournamentId,
        address player,
        uint256 betAmount,
        uint256 timestamp,
        GameOutcome outcome,
        bool settled
    ) {
        GameInfo storage game = games[_gameId];
        return (
            game.id,
            game.tournamentId,
            game.player,
            game.betAmount,
            game.timestamp,
            game.outcome,
            game.settled
        );
    }

    function getPlayerTournamentGames(uint256 _tournamentId, address _player) external view returns (uint256) {
        return tournamentPlayerGames[_tournamentId][_player];
    }
} 