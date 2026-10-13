// js/state.js — Estado compartilhado entre todos os módulos

// DOM Elements — referências únicas, exportadas para todos os módulos
export const saveRankingBtn     = document.getElementById('saveRankingBtn');
export const saveRankingText    = document.getElementById('saveRankingText');
export const resetAllBtn        = document.getElementById('resetAllBtn');
export const exportImageBtn     = document.getElementById('exportImageBtn');
export const tierlistBoard      = document.getElementById('tierlistBoard');
export const boardSkullWatermark= document.getElementById('boardSkullWatermark');
export const imagePool          = document.getElementById('imagePool');
export const poolPlaceholder    = document.getElementById('poolPlaceholder');
export const poolCounter        = document.getElementById('poolCounter');
export const clapperIcon        = document.getElementById('clapperIcon');
export const starsBurst         = document.getElementById('starsBurst');
export const imageModal         = document.getElementById('imageModal');
export const modalBackdrop      = document.getElementById('modalBackdrop');
export const modalCloseBtn      = document.getElementById('modalCloseBtn');
export const modalImg           = document.getElementById('modalImg');
export const modalCaption       = document.getElementById('modalCaption');
export const confirmResetModal  = document.getElementById('confirmResetModal');
export const confirmResetBackdrop = document.getElementById('confirmResetBackdrop');
export const cancelResetBtn     = document.getElementById('cancelResetBtn');
export const proceedResetBtn    = document.getElementById('proceedResetBtn');
export const smokeCanvas        = document.getElementById('smokeCanvas');
export const smokeCtx           = smokeCanvas ? smokeCanvas.getContext('2d') : null;

// Estado mutável de drag
export let draggedItem       = null;
export let isDraggingActive  = false;
export let currentActiveZone = null;
export let imageIdCounter    = 0;
export let clapperInterval   = null;

// Estado de fumaça
export let smokeParticles    = [];
export let smokeAnimFrame    = null;
export let lastSmokeEmitTime = 0;
export let lastSmokePos      = { x: -999, y: -999 };

// WeakMap para animações de altura
export const activeRowAnimations = new WeakMap();

// Setters (para módulos que precisam mutar o estado)
export function setDraggedItem(v)       { draggedItem = v; }
export function setIsDraggingActive(v)  { isDraggingActive = v; }
export function setCurrentActiveZone(v) { currentActiveZone = v; }
export function incImageIdCounter()     { return ++imageIdCounter; }
export function setClapperInterval(v)   { clapperInterval = v; }
export function setSmokeParticles(v)    { smokeParticles = v; }
export function setSmokeAnimFrame(v)    { smokeAnimFrame = v; }
export function setLastSmokeEmitTime(v) { lastSmokeEmitTime = v; }
export function setLastSmokePos(v)      { lastSmokePos = v; }
