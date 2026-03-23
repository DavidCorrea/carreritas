/**
 * Must load before any module that references the global `THREE` (legacy style).
 */
import * as THREE from 'three';

window.THREE = THREE;
