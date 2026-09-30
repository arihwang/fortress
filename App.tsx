
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Player, Wind, ProjectileState, ExplosionState } from './types';
import { GameStatus } from './types';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  GROUND_Y,
  GRAVITY,
  WIND_FACTOR,
  POWER_FACTOR,
  PLAYER_1_X,
  PLAYER_2_X,
  PLAYER_Y,
  PLAYER_HITBOX_RADIUS,
  INITIAL_HEALTH,
  DAMAGE_AMOUNT,
  CANNON_BASE_WIDTH,
  CANNON_BARREL_LENGTH,
  CANNON_BARREL_WIDTH,
  PROJECTILE_RADIUS,
  MAX_WIND_STRENGTH,
} from './constants';

// --- HELPER COMPONENTS (defined outside main App component) ---

interface CannonProps {
  angle: number;
  isFlipped: boolean;
}

const Cannon: React.FC<CannonProps> = ({ angle, isFlipped }) => {
  const rotation = isFlipped ? 180 - angle : angle;
  return (
    <div className="relative">
      <div
        className="absolute bottom-0 bg-slate-600 rounded-t-full"
        style={{
          width: `${CANNON_BASE_WIDTH}px`,
          height: `${CANNON_BASE_WIDTH / 2}px`,
          left: `-${CANNON_BASE_WIDTH / 2}px`,
        }}
      ></div>
      <div
        className="absolute bottom-0 bg-slate-800 border-2 border-slate-500 rounded"
        style={{
          width: `${CANNON_BARREL_LENGTH}px`,
          height: `${CANNON_BARREL_WIDTH}px`,
          left: `-${CANNON_BARREL_WIDTH / 2}px`,
          transformOrigin: '25% 50%',
          transform: `rotate(-${rotation}deg)`,
        }}
      ></div>
    </div>
  );
};

interface HealthBarProps {
  health: number;
  maxHealth: number;
  isFlipped: boolean;
}

const HealthBar: React.FC<HealthBarProps> = ({ health, maxHealth, isFlipped }) => {
  const healthPercentage = (health / maxHealth) * 100;
  return (
    <div className={`w-32 h-4 bg-gray-300 rounded overflow-hidden border-2 border-gray-500 ${isFlipped ? 'ml-auto' : 'mr-auto'}`}>
      <div
        className="h-full bg-green-500 transition-all duration-300"
        style={{ width: `${healthPercentage}%` }}
      ></div>
    </div>
  );
};

interface WindIndicatorProps {
  wind: Wind;
}

const WindIndicator: React.FC<WindIndicatorProps> = ({ wind }) => {
    const isLeft = wind.direction === 'left';
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-sky-200/50 p-2 rounded-lg text-slate-800 font-bold flex items-center gap-2 shadow-md">
            <span>Wind</span>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-6 w-6 transition-transform ${isLeft ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span>{wind.strength}</span>
        </div>
    );
};

interface ControlsProps {
  player: Player;
  onAngleChange: (angle: number) => void;
  onPowerChange: (power: number) => void;
  onFire: () => void;
  disabled: boolean;
  isPlayer1: boolean;
}

const Controls: React.FC<ControlsProps> = ({ player, onAngleChange, onPowerChange, onFire, disabled, isPlayer1 }) => {
  return (
    <div className={`absolute bottom-4 p-4 bg-slate-800/70 rounded-lg w-96 text-white shadow-xl ${isPlayer1 ? 'left-4' : 'right-4'}`}>
      <h2 className="text-xl font-bold mb-2 text-center">{`Player ${player.id}`}</h2>
      <div className="space-y-3">
        <div>
          <label className="block">Angle: {player.angle}°</label>
          <input
            type="range"
            min="0"
            max="90"
            value={player.angle}
            onChange={(e) => onAngleChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full"
          />
        </div>
        <div>
          <label className="block">Power: {player.power}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={player.power}
            onChange={(e) => onPowerChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full"
          />
        </div>
      </div>
      <button
        onClick={onFire}
        disabled={disabled}
        className="mt-4 w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded transition duration-200"
      >
        FIRE!
      </button>
    </div>
  );
};

const Projectile: React.FC<{ x: number, y: number }> = ({ x, y }) => (
    <div
        className="absolute bg-gray-900 rounded-full"
        style={{
            left: x - PROJECTILE_RADIUS,
            top: y - PROJECTILE_RADIUS,
            width: PROJECTILE_RADIUS * 2,
            height: PROJECTILE_RADIUS * 2,
        }}
    />
);

const Explosion: React.FC<{ x: number, y: number }> = ({ x, y }) => (
    <div
        className="absolute rounded-full bg-yellow-400 animate-ping"
        style={{
            left: x,
            top: y,
            width: 100,
            height: 100,
            transform: 'translate(-50%, -50%)',
        }}
    />
);

interface GameOverScreenProps {
    winner: Player;
    onReset: () => void;
}
const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, onReset }) => (
    <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-50">
        <h1 className="text-6xl font-bold text-white mb-4">Game Over</h1>
        <h2 className="text-4xl text-yellow-400 mb-8">Player {winner.id} Wins!</h2>
        <button
            onClick={onReset}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-2xl transition duration-200"
        >
            Play Again
        </button>
    </div>
);


// --- MAIN APP COMPONENT ---

function App() {
  const createInitialPlayers = (): [Player, Player] => [
    { id: 1, x: PLAYER_1_X, health: INITIAL_HEALTH, angle: 45, power: 50 },
    { id: 2, x: PLAYER_2_X, health: INITIAL_HEALTH, angle: 45, power: 50 },
  ];
  
  const generateWind = useCallback((): Wind => ({
      direction: Math.random() > 0.5 ? 'left' : 'right',
      strength: Math.floor(Math.random() * MAX_WIND_STRENGTH),
  }), []);

  const [players, setPlayers] = useState<[Player, Player]>(createInitialPlayers());
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.Aiming);
  const [turn, setTurn] = useState<number>(1);
  const [wind, setWind] = useState<Wind>(() => generateWind());
  const [projectile, setProjectile] = useState<ProjectileState | null>(null);
  const [explosion, setExplosion] = useState<ExplosionState | null>(null);

  const animationFrameId = useRef<number | null>(null);
  const projectileRef = useRef<ProjectileState | null>(null);
  const playersRef = useRef(players);
  playersRef.current = players;

  const resetGame = () => {
    setPlayers(createInitialPlayers());
    setGameStatus(GameStatus.Aiming);
    setTurn(1);
    setWind(generateWind());
    setProjectile(null);
    setExplosion(null);
  }

  const switchTurn = useCallback(() => {
    setTurn(currentTurn => (currentTurn === 1 ? 2 : 1));
    setGameStatus(GameStatus.Aiming);
    setWind(generateWind());
  }, [generateWind]);

  const handlePlayerUpdate = useCallback((id: number, updates: Partial<Player>) => {
    setPlayers(prevPlayers => {
      const newPlayers = [...prevPlayers] as [Player, Player];
      const playerIndex = newPlayers.findIndex(p => p.id === id);
      if (playerIndex !== -1) {
        newPlayers[playerIndex] = { ...newPlayers[playerIndex], ...updates };
      }
      return newPlayers;
    });
  }, []);

  const handleFire = () => {
    if (gameStatus !== GameStatus.Aiming) return;

    const currentPlayer = players[turn - 1];
    const isPlayer1 = currentPlayer.id === 1;

    const angleRad = (isPlayer1 ? currentPlayer.angle : 180 - currentPlayer.angle) * (Math.PI / 180);

    const startX = isPlayer1 
        ? currentPlayer.x + Math.cos(angleRad) * CANNON_BARREL_LENGTH
        : currentPlayer.x + Math.cos(angleRad) * CANNON_BARREL_LENGTH;

    const startY = PLAYER_Y - CANNON_BARREL_WIDTH / 2 - Math.sin(angleRad) * CANNON_BARREL_LENGTH;


    const initialProjectile: ProjectileState = {
      x: startX,
      y: startY,
      vx: Math.cos(angleRad) * currentPlayer.power * POWER_FACTOR,
      vy: -Math.sin(angleRad) * currentPlayer.power * POWER_FACTOR,
    };
    projectileRef.current = initialProjectile;
    setProjectile(initialProjectile);
    setGameStatus(GameStatus.Firing);
  };
  
  // 게임 루프: 상태 업데이트 함수(setState 콜백) 안에서 부수효과를 실행하지 않도록 ref로 탄환 위치를 관리합니다.
  // (개발 모드의 React는 업데이트 함수를 두 번 실행하므로, 그 안에서 데미지·턴 전환을 하면 두 번 적용됩니다.)
  useEffect(() => {
    if (gameStatus !== GameStatus.Firing) {
      return;
    }

    let timeoutId: number | undefined;

    const gameLoop = () => {
      const p = projectileRef.current;
      if (!p) return;

      const newProjectile: ProjectileState = {
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + GRAVITY,
        vx: p.vx + (wind.direction === 'right' ? 1 : -1) * wind.strength * WIND_FACTOR,
      };

      const currentPlayers = playersRef.current;
      const opponent = currentPlayers[turn === 1 ? 1 : 0];
      const distance = Math.hypot(newProjectile.x - opponent.x, newProjectile.y - (PLAYER_Y - PLAYER_HITBOX_RADIUS));

      const hit = distance < PLAYER_HITBOX_RADIUS;
      const outOfBounds = newProjectile.y >= GROUND_Y || newProjectile.x < 0 || newProjectile.x > SCREEN_WIDTH;

      if (hit || outOfBounds) {
        projectileRef.current = null;
        setProjectile(null);

        let opponentHealth = opponent.health;
        if (hit) {
          opponentHealth = Math.max(0, opponent.health - DAMAGE_AMOUNT);
          setExplosion({ x: opponent.x, y: PLAYER_Y });
          handlePlayerUpdate(opponent.id, { health: opponentHealth });
        } else {
          setExplosion({ x: newProjectile.x, y: GROUND_Y });
        }

        timeoutId = window.setTimeout(() => {
          setExplosion(null);
          if (opponentHealth <= 0) {
            setGameStatus(GameStatus.GameOver);
          } else {
            switchTurn();
          }
        }, 1000);
        return;
      }

      projectileRef.current = newProjectile;
      setProjectile(newProjectile);
      animationFrameId.current = requestAnimationFrame(gameLoop);
    };

    animationFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [gameStatus, turn, wind, handlePlayerUpdate, switchTurn]);
  
  const [player1, player2] = players;
  const currentPlayer = turn === 1 ? player1 : player2;
  const winner = players.find(p => p.health <= 0) ? (players[0].health <= 0 ? player2 : player1) : null;

  return (
    <div className="flex justify-center items-center h-screen bg-gray-800">
      <div
        className="relative bg-gradient-to-b from-sky-400 to-sky-600"
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, overflow: 'hidden' }}
      >
        {/* Background elements */}
        <div className="absolute bottom-0 left-0 w-full h-25 bg-yellow-200" style={{ height: 100, backgroundColor: '#f5deb3' }}/>
        <div className="absolute bottom-0 left-0 w-full h-20 bg-blue-500 opacity-70" style={{ height: 80, bottom: 20 }}/>
        <div className="absolute top-20 left-40 w-24 h-12 bg-white/80 rounded-full"></div>
        <div className="absolute top-32 left-80 w-32 h-16 bg-white/70 rounded-full"></div>

        {/* Game elements */}
        <div className="absolute" style={{ left: player1.x, top: PLAYER_Y }}>
            <Cannon angle={player1.angle} isFlipped={false} />
        </div>
        <div className="absolute" style={{ left: player2.x, top: PLAYER_Y }}>
            <Cannon angle={player2.angle} isFlipped={true} />
        </div>

        {projectile && <Projectile x={projectile.x} y={projectile.y} />}
        {explosion && <Explosion x={explosion.x} y={explosion.y} />}

        {/* UI elements */}
        <WindIndicator wind={wind} />
        <div className="absolute top-4 left-4 w-40">
            <h3 className="font-bold text-white text-lg">Player 1</h3>
            <HealthBar health={player1.health} maxHealth={INITIAL_HEALTH} isFlipped={false} />
        </div>
        <div className="absolute top-4 right-4 w-40">
            <h3 className="font-bold text-white text-lg text-right">Player 2</h3>
            <HealthBar health={player2.health} maxHealth={INITIAL_HEALTH} isFlipped={true} />
        </div>

        <Controls
          player={currentPlayer}
          onAngleChange={(angle) => handlePlayerUpdate(currentPlayer.id, { angle })}
          onPowerChange={(power) => handlePlayerUpdate(currentPlayer.id, { power })}
          onFire={handleFire}
          disabled={gameStatus !== GameStatus.Aiming || turn !== currentPlayer.id}
          isPlayer1={currentPlayer.id === 1}
        />
        
        {gameStatus === GameStatus.GameOver && winner && (
            <GameOverScreen winner={winner} onReset={resetGame} />
        )}

      </div>
    </div>
  );
}

export default App;
