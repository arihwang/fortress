
export enum GameStatus {
  Aiming = 'AIMING',
  Firing = 'FIRING',
  GameOver = 'GAME_OVER',
}

export type Player = {
  id: number;
  x: number;
  health: number;
  angle: number; // in degrees
  power: number; // 0-100
};

export type Wind = {
  direction: 'left' | 'right';
  strength: number; // 0-10
};

export type ProjectileState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type ExplosionState = {
  x: number;
  y: number;
};
