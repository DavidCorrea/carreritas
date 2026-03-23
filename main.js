import './src/setup-three.js';
import { applyStaticDocumentCopy } from './src/strings.js';
import Game from './src/game.js';

applyStaticDocumentCopy();
new Game();
