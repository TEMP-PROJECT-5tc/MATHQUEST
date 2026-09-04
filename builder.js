/* ==========================================================================
   MathQuest V3 - Módulo Constructor Matemático (Fase 4 - Implementación Completa)
   Áreas, Perímetros, Centro de Masa / Equilibrio, Sustracción de Áreas y Volumen
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    // Dimensiones de la cuadrícula de construcción
    const GRID_COLS = 12;
    const GRID_ROWS = 8;

    // Estado del juego
    let currentLevel = 1;
    let isRunning = false;
    let lives = 3;
    let selectedPiece = null;
    let placedPieces = []; // Array de { id, col, row, width, height, weight, volume, type, colorClass }
    let nextPieceId = 1;

    // Listeners registrados para limpieza completa
    let activeEventListeners = [];

    // Base de datos de niveles
    const LEVELS_DATA = {
        1: {
            name: 'El Pedestal',
            concept: 'Área de Rectángulos',
            targetArea: 24,
            instruction: 'Construye un pedestal rectangular con un Área exacta de 24 u².',
            formula: 'Área = ancho × alto',
            hint: '💡 Recuerda: Área = ancho × alto. Factores de 24: 6 × 4, 8 × 3 o 4 × 6. Coloca piezas que formen un rectángulo sólido.',
            quarry: [
                { width: 6, height: 4, label: 'Losa 6×4', weight: 10, type: 'rect' },
                { width: 4, height: 3, label: 'Bloque 4×3', weight: 5, type: 'rect' },
                { width: 4, height: 3, label: 'Bloque 4×3', weight: 5, type: 'rect' },
                { width: 8, height: 3, label: 'Viga 8×3', weight: 12, type: 'rect' },
                { width: 3, height: 2, label: 'Base 3×2', weight: 3, type: 'rect' },
                { width: 5, height: 4, label: 'Bloque 5×4', weight: 10, type: 'rect' } // Distractor (20 u²)
            ],
            validate: function(gridState, pieces) {
                if (pieces.length === 0) {
                    return { valid: false, reason: 'Coloca al menos una pieza en la cuadrícula.' };
                }
                const b = getBoundingBox(gridState);
                if (!b) return { valid: false, reason: 'La cuadrícula está vacía.' };

                const totalFilled = countFilledCells(gridState);
                const rectArea = b.width * b.height;

                if (totalFilled !== 24) {
                    return {
                        valid: false,
                        reason: `El área actual es de ${totalFilled} u² (debe ser exactamente 24 u²).`
                    };
                }

                if (totalFilled !== rectArea) {
                    return {
                        valid: false,
                        reason: 'Las piezas deben formar un rectángulo sólido y continuo sin huecos.'
                    };
                }

                return {
                    valid: true,
                    summary: `¡Excelente! Has construido un pedestal rectangular de ${b.width} × ${b.height} = 24 u².`
                };
            }
        },

        2: {
            name: 'Fachada Perimetral',
            concept: 'Área + Perímetro Restringido',
            targetArea: 36,
            maxPerimeter: 26,
            instruction: 'Construye una fachada rectangular con Área = 36 u² y Perímetro ≤ 26 u.',
            formula: 'Área = b × h  |  Perímetro = 2b + 2h ≤ 26 u',
            hint: '💡 Para una misma área, un cuadrado (6×6, P = 24 u) o rectángulo compacto (9×4, P = 26 u) optimiza el perímetro.',
            quarry: [
                { width: 6, height: 3, label: 'Piso 6×3', weight: 10, type: 'rect' },
                { width: 6, height: 3, label: 'Piso 6×3', weight: 10, type: 'rect' },
                { width: 9, height: 2, label: 'Panel 9×2', weight: 8, type: 'rect' },
                { width: 9, height: 2, label: 'Panel 9×2', weight: 8, type: 'rect' },
                { width: 6, height: 6, label: 'Muro 6×6', weight: 20, type: 'rect' },
                { width: 12, height: 3, label: 'Muro 12×3', weight: 15, type: 'rect' } // P = 30 > 26 (Distractor)
            ],
            validate: function(gridState, pieces) {
                if (pieces.length === 0) return { valid: false, reason: 'Coloca piezas en la cuadrícula.' };
                const b = getBoundingBox(gridState);
                if (!b) return { valid: false, reason: 'La cuadrícula está vacía.' };

                const totalFilled = countFilledCells(gridState);
                const rectArea = b.width * b.height;
                const perimeter = 2 * (b.width + b.height);

                if (totalFilled !== 36 || totalFilled !== rectArea) {
                    return {
                        valid: false,
                        reason: `El área debe ser un rectángulo sólido de 36 u² (actual: ${totalFilled} u²).`
                    };
                }

                if (perimeter > 26) {
                    return {
                        valid: false,
                        reason: `El perímetro actual es ${perimeter} u, el cual excede el límite máximo de 26 u.`
                    };
                }

                return {
                    valid: true,
                    summary: `¡Magnífico! Fachada de ${b.width} × ${b.height} = 36 u² con Perímetro de ${perimeter} u (≤ 26 u).`
                };
            }
        },

        3: {
            name: 'Contrapeso',
            concept: 'Centro de Masa y Equilibrio',
            baseMin: 4,
            baseMax: 7,
            minPieces: 3,
            instruction: 'Coloca al menos 3 piezas. El centro de masa x_cm debe situarse sobre la base de apoyo [X: 4 - 7].',
            formula: 'x_cm = Σ(mᵢ × xᵢ) / Σmᵢ  (debe estar entre 4.0 y 7.0)',
            hint: '💡 Fórmula de centro de masa: x_cm = Σ(mᵢ · xᵢ) / Σmᵢ. Equilibra contrapesos a ambos lados de la base para centrar x_cm.',
            quarry: [
                { width: 4, height: 1, label: 'Viga 4×1 (10kg)', weight: 10, type: 'beam' },
                { width: 6, height: 1, label: 'Viga Larga 6×1 (15kg)', weight: 15, type: 'beam' },
                { width: 2, height: 2, label: 'Pesa 2×2 (20kg)', weight: 20, type: 'weight' },
                { width: 2, height: 2, label: 'Pesa 2×2 (20kg)', weight: 20, type: 'weight' },
                { width: 1, height: 1, label: 'Plomo 1×1 (10kg)', weight: 10, type: 'weight' },
                { width: 3, height: 1, label: 'Pesa 3×1 (15kg)', weight: 15, type: 'weight' }
            ],
            validate: function(gridState, pieces) {
                if (pieces.length < 3) {
                    return { valid: false, reason: 'Debes colocar al menos 3 piezas para armar la estructura.' };
                }

                let totalMass = 0;
                let momentSum = 0;

                pieces.forEach(p => {
                    const m = p.weight || 10;
                    const xCenter = p.col + (p.width / 2);
                    totalMass += m;
                    momentSum += m * xCenter;
                });

                const xCm = totalMass > 0 ? (momentSum / totalMass) : 0;
                const isStable = xCm >= 4.0 && xCm <= 7.0;

                if (!isStable) {
                    return {
                        valid: false,
                        reason: `Estructura INESTABLE: x_cm = ${xCm.toFixed(2)} u está fuera de la base de apoyo [4.0, 7.0] u. ¡Colapsará!`
                    };
                }

                return {
                    valid: true,
                    summary: `¡Estructura ESTABLE! x_cm = ${xCm.toFixed(2)} u dentro del intervalo de apoyo [4.0, 7.0] u con masa de ${totalMass} kg.`
                };
            }
        },

        4: {
            name: 'El Pórtico',
            concept: 'Sustracción de Áreas (Vano)',
            targetNetArea: 32,
            instruction: 'Construye un pórtico monumental con un Área Neta de material de 32 u² (Área Total − Área del Vano interior).',
            formula: 'Área Neta = Área Envolvente Total − Área del Vano = 32 u²',
            hint: '💡 Construye 2 columnas laterales (2×6 cada una = 24 u²) y únelas arriba con una viga de 4×2 (8 u²): 24 + 8 = 32 u² de material.',
            quarry: [
                { width: 2, height: 6, label: 'Columna 2×6', weight: 15, type: 'rect' },
                { width: 2, height: 6, label: 'Columna 2×6', weight: 15, type: 'rect' },
                { width: 4, height: 2, label: 'Dintel 4×2', weight: 10, type: 'rect' },
                { width: 8, height: 2, label: 'Viga Frontal 8×2', weight: 12, type: 'rect' },
                { width: 2, height: 4, label: 'Pilar 2×4', weight: 8, type: 'rect' },
                { width: 2, height: 4, label: 'Pilar 2×4', weight: 8, type: 'rect' }
            ],
            validate: function(gridState, pieces) {
                if (pieces.length === 0) return { valid: false, reason: 'Coloca piezas para formar el pórtico.' };
                const b = getBoundingBox(gridState);
                if (!b) return { valid: false, reason: 'La cuadrícula está vacía.' };

                const totalFilled = countFilledCells(gridState);
                const grossArea = b.width * b.height;
                const voidArea = grossArea - totalFilled;

                if (voidArea <= 0) {
                    return {
                        valid: false,
                        reason: 'Un pórtico debe tener un vano (abertura/portal central interior) donde pase el arco.'
                    };
                }

                if (totalFilled !== 32) {
                    return {
                        valid: false,
                        reason: `El área neta de material es ${totalFilled} u² (debe ser exactamente 32 u²).`
                    };
                }

                return {
                    valid: true,
                    summary: `¡Pórtico perfecto! Área Total Envolvente = ${grossArea} u², Vano = ${voidArea} u², Área Neta = ${totalFilled} u².`
                };
            }
        },

        5: {
            name: 'Rascacielos Modular',
            concept: 'Volumen 3D y Equilibrio Multicapa',
            targetVolume: 48,
            requiredLayers: 3,
            instruction: 'Construye un rascacielos de 3 capas con un Volumen Total de 48 u³ y equilibrio entre pisos.',
            formula: 'Volumen = Capa 1 + Capa 2 + Capa 3 = 48 u³',
            hint: '💡 Coloca una base sólida de 6×3 (Volumen 18 u³) abajo, y dos niveles superiores (como 5×3 = 15 y 5×3 = 15) centrados: 18 + 15 + 15 = 48 u³.',
            quarry: [
                { width: 6, height: 3, label: 'Base Modular 6×3 (18 u³)', weight: 18, volume: 18, type: 'module' },
                { width: 5, height: 3, label: 'Piso Modular 5×3 (15 u³)', weight: 15, volume: 15, type: 'module' },
                { width: 5, height: 3, label: 'Ático Modular 5×3 (15 u³)', weight: 15, volume: 15, type: 'module' },
                { width: 4, height: 3, label: 'Módulo 4×3 (12 u³)', weight: 12, volume: 12, type: 'module' },
                { width: 3, height: 3, label: 'Módulo 3×3 (9 u³)', weight: 9, volume: 9, type: 'module' }
            ],
            validate: function(gridState, pieces) {
                if (pieces.length < 3) {
                    return { valid: false, reason: 'El rascacielos modular requiere al menos 3 capas o módulos apilados.' };
                }

                let totalVolume = 0;
                pieces.forEach(p => {
                    totalVolume += (p.volume || (p.width * p.height));
                });

                if (totalVolume !== 48) {
                    return {
                        valid: false,
                        reason: `El volumen total actual es ${totalVolume} u³ (debe ser exactamente 48 u³).`
                    };
                }

                // Validar apilamiento vertical y soporte
                const sortedPieces = [...pieces].sort((a, b) => b.row - a.row); // De abajo hacia arriba
                for (let i = 1; i < sortedPieces.length; i++) {
                    const upper = sortedPieces[i];
                    const lower = sortedPieces[i - 1];
                    const upperCenter = upper.col + (upper.width / 2);
                    const lowerMin = lower.col;
                    const lowerMax = lower.col + lower.width;

                    if (upperCenter < lowerMin || upperCenter > lowerMax) {
                        return {
                            valid: false,
                            reason: 'El módulo superior está desbalanceado y sobresale sin suficiente soporte del piso inferior.'
                        };
                    }
                }

                return {
                    valid: true,
                    summary: `¡Obra Maestra! Rascacielos de 3 capas con Volumen = 48 u³ y equilibrio estructural perfecto.`
                };
            }
        }
    };

    /* --------------------------------------------------------------------------
       Helpers Geométricos de Matriz
       -------------------------------------------------------------------------- */
    function createEmptyGrid() {
        const grid = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            grid[r] = [];
            for (let c = 0; c < GRID_COLS; c++) {
                grid[r][c] = null;
            }
        }
        return grid;
    }

    function buildGridState() {
        const grid = createEmptyGrid();
        placedPieces.forEach(piece => {
            for (let r = 0; r < piece.height; r++) {
                for (let c = 0; c < piece.width; c++) {
                    const gr = piece.row + r;
                    const gc = piece.col + c;
                    if (gr >= 0 && gr < GRID_ROWS && gc >= 0 && gc < GRID_COLS) {
                        grid[gr][gc] = piece;
                    }
                }
            }
        });
        return grid;
    }

    function canPlacePiece(piece, startCol, startRow, excludePieceId = null) {
        if (startCol < 0 || startRow < 0) return false;
        if (startCol + piece.width > GRID_COLS) return false;
        if (startRow + piece.height > GRID_ROWS) return false;

        const grid = createEmptyGrid();
        placedPieces.forEach(p => {
            if (excludePieceId && p.id === excludePieceId) return;
            for (let r = 0; r < p.height; r++) {
                for (let c = 0; c < p.width; c++) {
                    grid[p.row + r][p.col + c] = p.id;
                }
            }
        });

        for (let r = 0; r < piece.height; r++) {
            for (let c = 0; c < piece.width; c++) {
                if (grid[startRow + r][startCol + c] !== null) {
                    return false; // Colisión con otra pieza
                }
            }
        }
        return true;
    }

    function getBoundingBox(gridState) {
        let minX = GRID_COLS, maxX = -1;
        let minY = GRID_ROWS, maxY = -1;
        let hasCells = false;

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (gridState[r][c] !== null) {
                    hasCells = true;
                    if (c < minX) minX = c;
                    if (c > maxX) maxX = c;
                    if (r < minY) minY = r;
                    if (r > maxY) maxY = r;
                }
            }
        }

        if (!hasCells) return null;
        return {
            minX, maxX, minY, maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    function countFilledCells(gridState) {
        let count = 0;
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (gridState[r][c] !== null) count++;
            }
        }
        return count;
    }

    /* --------------------------------------------------------------------------
       Renderizado de Cuadrícula y Piezas
       -------------------------------------------------------------------------- */
    function renderRulers() {
        const rulerX = document.getElementById('builder-ruler-x');
        const rulerY = document.getElementById('builder-ruler-y');
        if (rulerX) {
            rulerX.innerHTML = '';
            for (let c = 0; c < GRID_COLS; c++) {
                const s = document.createElement('span');
                s.style.width = '32px';
                s.style.textAlign = 'center';
                s.innerText = c;
                rulerX.appendChild(s);
            }
        }
        if (rulerY) {
            rulerY.innerHTML = '';
            for (let r = 0; r < GRID_ROWS; r++) {
                const s = document.createElement('span');
                s.style.height = '32px';
                s.style.display = 'flex';
                s.style.alignItems = 'center';
                s.innerText = r;
                rulerY.appendChild(s);
            }
        }
    }

    function renderGrid() {
        const gridEl = document.getElementById('builder-grid');
        if (!gridEl) return;

        gridEl.innerHTML = '';
        const gridState = buildGridState();

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const cell = document.createElement('div');
                cell.className = 'builder-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.id = `builder-cell-${r}-${c}`;

                const piece = gridState[r][c];
                if (piece) {
                    cell.classList.add('cell-placed');
                    if (currentLevel === 3) {
                        cell.classList.add('cell-counterweight');
                    } else if (currentLevel === 4 && piece.type === 'rect') {
                        cell.classList.add('cell-stone');
                    } else if (currentLevel === 5) {
                        cell.classList.add('cell-top-layer');
                    }
                    cell.title = `${piece.label} (Clic para retirar)`;
                }

                // Eventos de interacción (Touch y Clic)
                addTrackedListener(cell, 'mouseenter', () => handleCellHover(c, r));
                addTrackedListener(cell, 'mouseleave', () => clearCellHover());
                addTrackedListener(cell, 'click', () => handleCellClick(c, r));

                // Soporte HTML5 Drag & Drop
                addTrackedListener(cell, 'dragover', (e) => {
                    e.preventDefault();
                    handleCellHover(c, r);
                });
                addTrackedListener(cell, 'drop', (e) => {
                    e.preventDefault();
                    handleCellClick(c, r);
                });

                gridEl.appendChild(cell);
            }
        }

        updateMeasurements();
    }

    function renderQuarry() {
        const quarryContainer = document.getElementById('builder-quarry-container');
        if (!quarryContainer) return;

        quarryContainer.innerHTML = '';
        const lvlData = LEVELS_DATA[currentLevel];
        if (!lvlData) return;

        lvlData.quarry.forEach((p, idx) => {
            const pieceEl = document.createElement('div');
            pieceEl.className = 'builder-piece';
            pieceEl.id = `quarry-piece-${idx}`;
            pieceEl.draggable = true;

            if (selectedPiece && selectedPiece.quarryIndex === idx) {
                pieceEl.classList.add('selected');
            }

            const area = p.width * p.height;
            let metaHtml = `<span class="piece-meta">Área: ${area} u²</span>`;
            if (currentLevel === 3) {
                metaHtml += `<span class="piece-weight">Masa: ${p.weight} kg</span>`;
            } else if (currentLevel === 5) {
                metaHtml += `<span class="piece-weight">Volumen: ${p.volume || area} u³</span>`;
            }

            pieceEl.innerHTML = `
                <span class="piece-dims">${p.width} × ${p.height}</span>
                ${metaHtml}
            `;

            // Click para seleccionar
            addTrackedListener(pieceEl, 'click', (e) => {
                e.stopPropagation();
                selectQuarryPiece(p, idx);
            });

            // Dragstart para arrastrar a la cuadrícula
            addTrackedListener(pieceEl, 'dragstart', (e) => {
                selectQuarryPiece(p, idx);
                pieceEl.classList.add('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', idx.toString());
                }
            });

            addTrackedListener(pieceEl, 'dragend', () => {
                pieceEl.classList.remove('dragging');
            });

            quarryContainer.appendChild(pieceEl);
        });
    }

    function selectQuarryPiece(pieceConfig, quarryIndex) {
        selectedPiece = {
            width: pieceConfig.width,
            height: pieceConfig.height,
            label: pieceConfig.label,
            weight: pieceConfig.weight || 10,
            volume: pieceConfig.volume || (pieceConfig.width * pieceConfig.height),
            type: pieceConfig.type || 'rect',
            quarryIndex: quarryIndex
        };

        if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
            window.SoundEngine.playClick();
        }

        renderQuarry();
        setFeedback(`📐 Pieza seleccionada: ${selectedPiece.width} × ${selectedPiece.height}. Haz clic o arrastra a la cuadrícula.`);
    }

    function rotateSelectedPiece() {
        if (!selectedPiece) {
            setFeedback('⚠️ Primero selecciona una pieza de la cantera para rotarla.');
            return;
        }

        const temp = selectedPiece.width;
        selectedPiece.width = selectedPiece.height;
        selectedPiece.height = temp;

        if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
            window.SoundEngine.playClick();
        }

        renderQuarry();
        setFeedback(`🔄 Pieza rotada a ${selectedPiece.width} × ${selectedPiece.height}.`);
    }

    /* --------------------------------------------------------------------------
       Manejo de Celdas y Colocación
       -------------------------------------------------------------------------- */
    function handleCellHover(col, row) {
        clearCellHover();
        if (!selectedPiece) return;

        const isValid = canPlacePiece(selectedPiece, col, row);
        const className = isValid ? 'hover-valid' : 'hover-invalid';

        for (let r = 0; r < selectedPiece.height; r++) {
            for (let c = 0; c < selectedPiece.width; c++) {
                const tr = row + r;
                const tc = col + c;
                if (tr < GRID_ROWS && tc < GRID_COLS) {
                    const cell = document.getElementById(`builder-cell-${tr}-${tc}`);
                    if (cell) cell.classList.add(className);
                }
            }
        }
    }

    function clearCellHover() {
        const cells = document.querySelectorAll('.builder-cell.hover-valid, .builder-cell.hover-invalid');
        cells.forEach(c => {
            c.classList.remove('hover-valid', 'hover-invalid');
        });
    }

    function handleCellClick(col, row) {
        const gridState = buildGridState();
        const existingPiece = gridState[row][col];

        // Si ya hay una pieza en la celda y no estamos colocando una nueva, la retiramos
        if (existingPiece && !selectedPiece) {
            removePlacedPiece(existingPiece.id);
            return;
        }

        if (!selectedPiece) {
            setFeedback('💡 Selecciona primero una pieza de la cantera inferior.');
            return;
        }

        if (!canPlacePiece(selectedPiece, col, row)) {
            if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
                window.SoundEngine.playWrong();
            }
            setFeedback('❌ Espacio insuficiente o colisión con otra pieza en esa posición.');
            return;
        }

        // Colocar la pieza
        const newPiece = {
            id: nextPieceId++,
            col: col,
            row: row,
            width: selectedPiece.width,
            height: selectedPiece.height,
            weight: selectedPiece.weight,
            volume: selectedPiece.volume,
            label: selectedPiece.label,
            type: selectedPiece.type
        };

        placedPieces.push(newPiece);

        if (window.SoundEngine && typeof window.SoundEngine.playPop === 'function') {
            window.SoundEngine.playPop();
        }

        setFeedback(`🧱 Colocada pieza ${newPiece.width} × ${newPiece.height} en (${col}, ${row}).`);
        renderGrid();
    }

    function removePlacedPiece(pieceId) {
        placedPieces = placedPieces.filter(p => p.id !== pieceId);
        if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
            window.SoundEngine.playClick();
        }
        setFeedback('🧹 Pieza retirada de la cuadrícula.');
        renderGrid();
    }

    function clearAllPlacedPieces() {
        placedPieces = [];
        if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
            window.SoundEngine.playClick();
        }
        setFeedback('🧹 Cuadrícula limpiada.');
        renderGrid();
    }

    /* --------------------------------------------------------------------------
       Mediciones en Tiempo Real
       -------------------------------------------------------------------------- */
    function updateMeasurements() {
        const gridState = buildGridState();
        const b = getBoundingBox(gridState);
        const totalFilled = countFilledCells(gridState);

        const dimEl = document.getElementById('builder-dim-current');
        const areaEl = document.getElementById('builder-area-current');
        const perimRow = document.getElementById('builder-perimeter-row');
        const perimEl = document.getElementById('builder-perimeter-current');
        const cmRow = document.getElementById('builder-cm-row');
        const cmEl = document.getElementById('builder-cm-current');
        const volRow = document.getElementById('builder-volume-row');
        const volEl = document.getElementById('builder-volume-current');
        const stabEl = document.getElementById('builder-stability-display');

        if (dimEl) dimEl.innerText = b ? `${b.width} × ${b.height} u` : '0 × 0 u';
        if (areaEl) areaEl.innerText = `${totalFilled} u²`;

        // Perímetro (Nivel 2)
        if (perimRow && perimEl) {
            if (currentLevel === 2) {
                perimRow.style.display = 'flex';
                const p = b ? 2 * (b.width + b.height) : 0;
                perimEl.innerText = `${p} u (Máx: 26 u)`;
                perimEl.style.color = p <= 26 ? '#34d399' : '#f87171';
            } else {
                perimRow.style.display = 'none';
            }
        }

        // Centro de Masa (Nivel 3)
        if (cmRow && cmEl) {
            if (currentLevel === 3) {
                cmRow.style.display = 'flex';
                let totalM = 0;
                let moment = 0;
                placedPieces.forEach(p => {
                    const m = p.weight || 10;
                    totalM += m;
                    moment += m * (p.col + p.width / 2);
                });
                const xCm = totalM > 0 ? (moment / totalM) : 0;
                const isStable = totalM > 0 && xCm >= 4.0 && xCm <= 7.0;
                cmEl.innerText = totalM > 0 ? `${xCm.toFixed(2)} u` : '--';
                cmEl.style.color = isStable ? '#34d399' : '#f59e0b';
                if (stabEl) {
                    stabEl.innerText = totalM > 0 ? (isStable ? 'Estable ✅' : 'Inestable ⚠️') : 'En Espera';
                    stabEl.style.color = isStable ? '#34d399' : '#f59e0b';
                }
            } else {
                cmRow.style.display = 'none';
            }
        }

        // Volumen (Nivel 5)
        if (volRow && volEl) {
            if (currentLevel === 5) {
                volRow.style.display = 'flex';
                let vol = 0;
                placedPieces.forEach(p => vol += (p.volume || p.width * p.height));
                volEl.innerText = `${vol} u³ / 48 u³`;
                volEl.style.color = vol === 48 ? '#34d399' : '#38bdf8';
            } else {
                volRow.style.display = 'none';
            }
        }

        if (currentLevel !== 3 && stabEl) {
            stabEl.innerText = placedPieces.length > 0 ? 'Construyendo...' : 'En Espera';
            stabEl.style.color = '#94a3b8';
        }
    }

    function setFeedback(msg, isSuccess = false, isError = false) {
        const fb = document.getElementById('builder-feedback');
        const textEl = document.getElementById('builder-feedback-text');
        if (!fb || !textEl) return;

        textEl.innerText = msg;
        fb.classList.remove('builder-stable', 'builder-unstable');

        if (isSuccess) {
            fb.classList.add('builder-stable');
        } else if (isError) {
            fb.classList.add('builder-unstable');
        }
    }

    /* --------------------------------------------------------------------------
       Validación y Fin de Nivel
       -------------------------------------------------------------------------- */
    function validateConstruction() {
        if (!isRunning) return;

        const lvlData = LEVELS_DATA[currentLevel];
        if (!lvlData) return;

        const gridState = buildGridState();
        const result = lvlData.validate(gridState, placedPieces);

        if (result.valid) {
            handleVictory(result.summary);
        } else {
            handleFailedAttempt(result.reason);
        }
    }

    function handleFailedAttempt(reason) {
        lives--;
        updateLivesDisplay();
        setFeedback(`⚠️ ${reason}`, false, true);

        if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
            window.SoundEngine.playWrong();
        }

        if (lives <= 0) {
            handleGameOver();
        }
    }

    function updateLivesDisplay() {
        const box = document.getElementById('builder-hearts-box');
        if (!box) return;
        let hearts = '';
        for (let i = 0; i < 3; i++) {
            hearts += (i < lives) ? '❤️ ' : '🖤 ';
        }
        box.innerText = hearts.trim();
    }

    function handleVictory(summaryText) {
        isRunning = false;

        if (window.SoundEngine && typeof window.SoundEngine.playFanfare === 'function') {
            window.SoundEngine.playFanfare();
        }

        let coinsEarned = 50;
        if (typeof window.completeGameLevel === 'function') {
            coinsEarned = window.completeGameLevel('builder', currentLevel) || 50;
        }

        const overlay = document.getElementById('builder-overlay');
        const card = document.getElementById('builder-overlay-card');
        const title = document.getElementById('builder-overlay-title');
        const rules = document.getElementById('builder-overlay-rules');
        const mathSummary = document.getElementById('builder-overlay-math-summary');
        const text = document.getElementById('builder-overlay-text');
        const btnStart = document.getElementById('btn-start-builder-game');

        if (card) {
            card.classList.remove('builder-game-over');
            card.classList.add('builder-victory');
        }

        if (title) title.innerText = `¡Construcción Aprobada! 🏆`;
        if (rules) rules.classList.add('hidden');
        if (mathSummary) {
            mathSummary.classList.remove('hidden');
            mathSummary.innerHTML = `
                <strong>📐 Análisis Geométrico Exitoso:</strong>
                <p style="margin: 6px 0 0 0;">${summaryText}</p>
                <p style="margin: 6px 0 0 0; color: #fbbf24; font-weight: 700;">+${coinsEarned} MathCoins Obtenidas 🪙</p>
            `;
        }

        if (text) {
            text.innerText = (currentLevel < 5)
                ? '¡Felicidades! Desbloqueaste el siguiente plano arquitectónico.'
                : '🎉 ¡Has completado los 5 niveles del Constructor Matemático!';
        }

        if (btnStart) {
            btnStart.innerText = (currentLevel < 5) ? 'Siguiente Nivel ➡️' : 'Volver al Menú 🏰';
            btnStart.onclick = () => {
                if (currentLevel < 5) {
                    BuilderGame.start(currentLevel + 1);
                } else {
                    const btnBack = document.getElementById('btn-back-menu');
                    if (btnBack) btnBack.click();
                }
            };
        }

        if (overlay) overlay.classList.remove('hidden');
    }

    function handleGameOver() {
        isRunning = false;

        if (window.SoundEngine && typeof window.SoundEngine.playGameOver === 'function') {
            window.SoundEngine.playGameOver();
        }

        const overlay = document.getElementById('builder-overlay');
        const card = document.getElementById('builder-overlay-card');
        const title = document.getElementById('builder-overlay-title');
        const rules = document.getElementById('builder-overlay-rules');
        const mathSummary = document.getElementById('builder-overlay-math-summary');
        const text = document.getElementById('builder-overlay-text');
        const btnStart = document.getElementById('btn-start-builder-game');

        if (card) {
            card.classList.remove('builder-victory');
            card.classList.add('builder-game-over');
        }

        if (title) title.innerText = `¡Estructura Colapsada! 💥`;
        if (rules) rules.classList.add('hidden');
        if (mathSummary) {
            mathSummary.classList.remove('hidden');
            mathSummary.innerHTML = `
                <p>Se agotaron los 3 intentos permitidos para este plano.</p>
                <p style="color: #94a3b8; font-size: 0.8rem;">Revisa las fórmulas y asegúrate de que las dimensiones coincidan exactamente.</p>
            `;
        }

        if (text) text.innerText = 'Inténtalo de nuevo aplicando las reglas geométricas con precisión.';
        if (btnStart) {
            btnStart.innerText = 'Reintentar Plano 🔄';
            btnStart.onclick = () => {
                BuilderGame.start(currentLevel);
            };
        }

        if (overlay) overlay.classList.remove('hidden');
    }

    /* --------------------------------------------------------------------------
       Gestor de Listeners y Limpieza
       -------------------------------------------------------------------------- */
    function addTrackedListener(target, event, handler) {
        if (!target) return;
        target.addEventListener(event, handler);
        activeEventListeners.push({ target, event, handler });
    }

    function clearAllTrackedListeners() {
        activeEventListeners.forEach(({ target, event, handler }) => {
            try {
                target.removeEventListener(event, handler);
            } catch (e) {}
        });
        activeEventListeners = [];
    }

    /* --------------------------------------------------------------------------
       Inicialización de Nivel
       -------------------------------------------------------------------------- */
    function setupLevelUI(lvl) {
        const lvlData = LEVELS_DATA[lvl] || LEVELS_DATA[1];

        const nameEl = document.getElementById('builder-level-name');
        if (nameEl) nameEl.innerText = `🏗️ Nivel ${lvl}: ${lvlData.name}`;

        const eqEl = document.getElementById('builder-equation');
        if (eqEl) eqEl.innerText = lvlData.instruction;

        const subEl = document.getElementById('builder-sub-objective');
        if (subEl) subEl.innerText = `Regla: ${lvlData.formula}`;

        const baseIndicator = document.getElementById('builder-support-base-indicator');
        if (baseIndicator) {
            if (lvl === 3) {
                baseIndicator.classList.remove('hidden');
            } else {
                baseIndicator.classList.add('hidden');
            }
        }

        updateLivesDisplay();
        renderRulers();
        renderQuarry();
        renderGrid();
        setFeedback(`📐 Nivel ${lvl} listo. Selecciona piezas y constrúyelas en la cuadrícula.`);
    }

    /* --------------------------------------------------------------------------
       Contrato Oficial window.MathQuestGames.builder
       -------------------------------------------------------------------------- */
    const BuilderGame = {
        name: 'Constructor Matemático',
        icon: '🧱',
        topic: 'geometry',
        screenId: 'game-builder-screen',

        start: function(level) {
            this.stop(); // Detener cualquier estado previo limpiamente

            currentLevel = parseInt(level) || 1;
            if (currentLevel < 1 || currentLevel > 5) currentLevel = 1;

            isRunning = true;
            lives = 3;
            selectedPiece = null;
            placedPieces = [];
            nextPieceId = 1;

            setupLevelUI(currentLevel);

            // Conectar botones estáticos de acción
            const btnValidate = document.getElementById('btn-validate-builder');
            if (btnValidate) {
                addTrackedListener(btnValidate, 'click', () => validateConstruction());
            }

            const btnClear = document.getElementById('btn-clear-grid-builder');
            if (btnClear) {
                addTrackedListener(btnClear, 'click', () => clearAllPlacedPieces());
            }

            const btnRotate = document.getElementById('btn-rotate-piece');
            if (btnRotate) {
                addTrackedListener(btnRotate, 'click', () => rotateSelectedPiece());
            }

            const btnHint = document.getElementById('btn-use-hint-builder');
            if (btnHint) {
                addTrackedListener(btnHint, 'click', () => this.useHint());
            }

            const btnRestart = document.getElementById('btn-restart-builder');
            if (btnRestart) {
                addTrackedListener(btnRestart, 'click', () => this.start(currentLevel));
            }

            // Configurar pantalla de bienvenida
            const overlay = document.getElementById('builder-overlay');
            const card = document.getElementById('builder-overlay-card');
            const title = document.getElementById('builder-overlay-title');
            const rules = document.getElementById('builder-overlay-rules');
            const rulesList = document.getElementById('builder-rules-list');
            const mathSummary = document.getElementById('builder-overlay-math-summary');
            const text = document.getElementById('builder-overlay-text');
            const btnStart = document.getElementById('btn-start-builder-game');

            if (card) card.classList.remove('builder-victory', 'builder-game-over');
            if (title) title.innerText = `Constructor: Nivel ${currentLevel} 🏗️`;
            if (rules) rules.classList.remove('hidden');
            if (mathSummary) mathSummary.classList.add('hidden');

            const lvlData = LEVELS_DATA[currentLevel];
            if (rulesList && lvlData) {
                rulesList.innerHTML = `
                    <li>📐 <strong>Objetivo:</strong> ${lvlData.instruction}</li>
                    <li>📐 <strong>Fórmula Clave:</strong> ${lvlData.formula}</li>
                    <li>🧱 Haz clic en las piezas para seleccionarlas o arrástralas a la cuadrícula.</li>
                    <li>💥 Tienes 3 intentos antes de que colapse la obra.</li>
                `;
            }

            if (text) text.innerText = 'Inspecciona el plano y comienza la construcción.';
            if (btnStart) {
                btnStart.innerText = '¡Iniciar Obra! 📐';
                btnStart.onclick = () => {
                    if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
                        window.SoundEngine.playClick();
                    }
                    if (overlay) overlay.classList.add('hidden');
                };
            }

            if (overlay) overlay.classList.remove('hidden');
        },

        stop: function() {
            isRunning = false;
            selectedPiece = null;
            placedPieces = [];
            clearAllTrackedListeners();
            clearCellHover();

            const overlay = document.getElementById('builder-overlay');
            if (overlay) overlay.classList.add('hidden');
        },

        useHint: function() {
            if (!isRunning) {
                if (window.showToast) window.showToast("Inicia el nivel para usar pistas.");
                return false;
            }

            const isVip = window.state && window.state.vipBypassPurchased;
            const hintsCount = (window.state && window.state.globalHints) || 0;

            if (!isVip && hintsCount <= 0) {
                if (window.showToast) window.showToast("❌ No tienes pistas en tu mochila. ¡Cómpralas en la Tienda!");
                if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
                    window.SoundEngine.playWrong();
                }
                return false;
            }

            // Consumir pista de la economía MathQuest
            if (!isVip && window.state) {
                window.state.globalHints--;
                if (window.saveStateToStorage) window.saveStateToStorage();
                if (window.updateHeaderStats) window.updateHeaderStats();
            }

            const lvlData = LEVELS_DATA[currentLevel];
            const hintMsg = lvlData ? lvlData.hint : "📐 Analiza cuidadosamente los requisitos del plano.";

            if (window.SoundEngine && typeof window.SoundEngine.playShield === 'function') {
                window.SoundEngine.playShield();
            }

            if (window.showToast) {
                window.showToast(`💡 Pista Obra: ${hintMsg}`);
            }

            setFeedback(`💡 PISTA: ${hintMsg}`);
            return true;
        }
    };

    window.MathQuestGames['builder'] = BuilderGame;

})();
