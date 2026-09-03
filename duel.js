/* ==========================================================================
   MathQuest V3 - Módulo Duelo Matemático (Fase 4.5 - Implementación Completa)
   Batalla Táctica por Turnos 1v1 contra el Jefe Mateo
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    // Configuración de niveles según especificación
    const BOSS_HP = {
        1: 60,
        2: 80,
        3: 100,
        4: 125,
        5: 150
    };

    const TURN_TIME = {
        1: 6.0,
        2: 5.5,
        3: 5.0,
        4: 4.0,
        5: 3.5
    };

    const PLAYER_MAX_HP = 100;
    const BASE_PLAYER_DAMAGE = 20;

    // Helper para barajar arreglos
    function shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Helper para generar distractores numéricos enteros únicos
    function generateIntegerDistractors(correctVal, count = 3, deltaRange = [1, 10]) {
        const distractors = new Set();
        const offsets = [-1, 1, -2, 2, -10, 10, -5, 5, -3, 3, -4, 4];
        shuffle(offsets);

        for (const off of offsets) {
            const cand = correctVal + off;
            if (cand !== correctVal && cand > 0) {
                distractors.add(cand);
                if (distractors.size >= count) break;
            }
        }

        while (distractors.size < count) {
            const rnd = correctVal + Math.floor(Math.random() * 15) - 7;
            if (rnd !== correctVal && rnd > 0) {
                distractors.add(rnd);
            }
        }

        return Array.from(distractors).slice(0, count);
    }

    /* --------------------------------------------------------------------------
       Generadores de Preguntas Matemáticas por Nivel
       -------------------------------------------------------------------------- */

    // NIVEL 1 — ARITMÉTICA
    function generateLevel1() {
        const opType = Math.floor(Math.random() * 4); // 0: suma, 1: resta, 2: mult, 3: div
        let prompt = "Resuelve la operación:";
        let equation = "";
        let answer = 0;
        let hint = "";

        if (opType === 0) {
            // Suma
            const a = Math.floor(Math.random() * 45) + 15;
            const b = Math.floor(Math.random() * 45) + 12;
            answer = a + b;
            equation = `${a} + ${b} = ?`;
            hint = `Suma primero las decenas (${Math.floor(a/10)*10} + ${Math.floor(b/10)*10}) y luego las unidades.`;
        } else if (opType === 1) {
            // Resta
            const a = Math.floor(Math.random() * 50) + 40;
            const b = Math.floor(Math.random() * 30) + 11;
            answer = a - b;
            equation = `${a} - ${b} = ?`;
            hint = `Resta paso a paso: ${a} - ${Math.floor(b/10)*10} - ${b%10}.`;
        } else if (opType === 2) {
            // Multiplicación básica
            const a = Math.floor(Math.random() * 7) + 4; // 4-10
            const b = Math.floor(Math.random() * 8) + 5; // 5-12
            answer = a * b;
            equation = `${a} × ${b} = ?`;
            hint = `Tabla del ${a}: ${a} × ${b - 1} = ${a * (b - 1)}, súmale ${a}.`;
        } else {
            // División exacta
            const b = Math.floor(Math.random() * 7) + 3; // 3-9
            const q = Math.floor(Math.random() * 8) + 4; // 4-11
            const a = b * q;
            answer = q;
            equation = `${a} ÷ ${b} = ?`;
            hint = `Busca qué número multiplicado por ${b} resulta en ${a}.`;
        }

        const distractors = generateIntegerDistractors(answer, 3);
        const options = shuffle([answer.toString(), ...distractors.map(d => d.toString())]);

        return {
            topic: "Aritmética",
            prompt: prompt,
            equation: equation,
            options: options,
            answer: answer.toString(),
            hint: hint
        };
    }

    // NIVEL 2 — FRACCIONES Y PORCENTAJES
    function generateLevel2() {
        const subtype = Math.floor(Math.random() * 4);
        let topic = "Fracciones & Porcentajes";

        if (subtype === 0) {
            // Fracción equivalente
            const pool = [
                { f: "3/4", eq: "6/8", bad: ["3/8", "4/6", "5/8"], h: "Multiplica numerador y denominador por 2: 3×2=6, 4×2=8." },
                { f: "2/5", eq: "4/10", bad: ["2/10", "5/2", "3/5"], h: "Duplica numerador y denominador: 2/5 = 4/10." },
                { f: "1/2", eq: "4/8", bad: ["1/4", "2/6", "3/5"], h: "Cualquier fracción donde el numerador es la mitad del denominador equivale a 1/2." },
                { f: "2/3", eq: "6/9", bad: ["4/9", "3/6", "5/6"], h: "Multiplica ambos términos por 3: 2×3 / 3×3 = 6/9." },
                { f: "3/5", eq: "6/10", bad: ["3/10", "5/3", "4/10"], h: "Multiplica numerador y denominador por 2." },
                { f: "4/5", eq: "8/10", bad: ["4/10", "5/4", "6/10"], h: "Multiplica ambos números por 2: 4/5 = 8/10." },
                { f: "1/3", eq: "3/9", bad: ["2/9", "1/6", "3/6"], h: "Multiplica numerador y denominador por 3." }
            ];
            const item = pool[Math.floor(Math.random() * pool.length)];
            return {
                topic: topic,
                prompt: `¿Qué fracción equivale a ${item.f}?`,
                equation: `\\frac{a}{b} \\equiv ${item.f}`,
                options: shuffle([item.eq, ...item.bad]),
                answer: item.eq,
                hint: item.h
            };
        } else if (subtype === 1) {
            // Comparación de fracciones
            const pool = [
                { q: "¿Cuál fracción es MAYOR: 3/4 o 2/3?", ans: "3/4", bad: ["2/3", "Son iguales", "1/2"], h: "3/4 = 0.75 y 2/3 ≈ 0.67. Por tanto 3/4 es mayor." },
                { q: "¿Cuál fracción es MENOR: 1/4 o 1/2?", ans: "1/4", bad: ["1/2", "Son iguales", "3/4"], h: "Dividir en 4 partes produce trozos más pequeños que dividir en 2." },
                { q: "¿Cuál fracción es MAYOR: 4/5 o 3/5?", ans: "4/5", bad: ["3/5", "Son iguales", "1/5"], h: "Con el mismo denominador, la de mayor numerador es más grande." },
                { q: "¿Cuál fracción es MENOR: 2/5 o 3/10?", ans: "3/10", bad: ["2/5", "Son iguales", "4/10"], h: "2/5 equivale a 4/10, que es mayor que 3/10." },
                { q: "¿Cuál fracción es MAYOR: 5/8 o 1/2?", ans: "5/8", bad: ["1/2", "Son iguales", "3/8"], h: "1/2 equivale a 4/8, y 5/8 es mayor que 4/8." }
            ];
            const item = pool[Math.floor(Math.random() * pool.length)];
            return {
                topic: topic,
                prompt: item.q,
                equation: item.q,
                options: shuffle([item.ans, ...item.bad]),
                answer: item.ans,
                hint: item.h
            };
        } else if (subtype === 2) {
            // Porcentajes directos
            const pctPool = [
                { pct: 25, base: 80, ans: 20, bad: [15, 25, 40], h: "El 25% es la cuarta parte: 80 ÷ 4 = 20." },
                { pct: 50, base: 140, ans: 70, bad: [50, 60, 80], h: "El 50% es la mitad: 140 ÷ 2 = 70." },
                { pct: 10, base: 250, ans: 25, bad: [20, 50, 15], h: "El 10% se calcula dividiendo entre 10: 250 ÷ 10 = 25." },
                { pct: 75, base: 40, ans: 30, bad: [20, 25, 35], h: "El 75% es tres cuartas partes: (40 ÷ 4) × 3 = 30." },
                { pct: 20, base: 60, ans: 12, bad: [10, 15, 20], h: "El 20% es la quinta parte: 60 ÷ 5 = 12." },
                { pct: 25, base: 120, ans: 30, bad: [25, 35, 40], h: "El 25% de 120 es 120 ÷ 4 = 30." },
                { pct: 50, base: 96, ans: 48, bad: [46, 52, 44], h: "La mitad exacta de 96 es 48." },
                { pct: 10, base: 340, ans: 34, bad: [30, 40, 24], h: "340 ÷ 10 = 34." }
            ];
            const item = pctPool[Math.floor(Math.random() * pctPool.length)];
            return {
                topic: topic,
                prompt: `Calcula el porcentaje indicado:`,
                equation: `\\text{¿Cuánto es el } ${item.pct}\\% \\text{ de } ${item.base}\\text{?}`,
                options: shuffle([item.ans.toString(), ...item.bad.map(b => b.toString())]),
                answer: item.ans.toString(),
                hint: item.h
            };
        } else {
            // Conversiones decimal a porcentaje / fracción
            const convPool = [
                { q: "Convierte 0.5 a porcentaje:", eq: "0.5 \\rightarrow \\%?", ans: "50%", bad: ["5%", "0.5%", "500%"], h: "Multiplica el decimal por 100: 0.5 × 100 = 50%." },
                { q: "Convierte 0.25 a porcentaje:", eq: "0.25 \\rightarrow \\%?", ans: "25%", bad: ["2.5%", "250%", "20%"], h: "0.25 × 100 = 25%." },
                { q: "Convierte 0.75 a porcentaje:", eq: "0.75 \\rightarrow \\%?", ans: "75%", bad: ["7.5%", "750%", "70%"], h: "0.75 × 100 = 75%." },
                { q: "Convierte 0.2 a porcentaje:", eq: "0.2 \\rightarrow \\%?", ans: "20%", bad: ["2%", "200%", "25%"], h: "0.2 × 100 = 20%." },
                { q: "¿Qué fracción simple representa 0.5?", eq: "0.5 \\equiv \\frac{a}{b}", ans: "1/2", bad: ["1/5", "5/100", "2/3"], h: "0.5 = 5/10 = 1/2." },
                { q: "¿Qué fracción simple representa 0.25?", eq: "0.25 \\equiv \\frac{a}{b}", ans: "1/4", bad: ["1/2", "2/5", "1/5"], h: "0.25 = 25/100 = 1/4." }
            ];
            const item = convPool[Math.floor(Math.random() * convPool.length)];
            return {
                topic: topic,
                prompt: item.q,
                equation: item.eq,
                options: shuffle([item.ans, ...item.bad]),
                answer: item.ans,
                hint: item.h
            };
        }
    }

    // NIVEL 3 — ECUACIONES
    function generateLevel3() {
        const subtype = Math.floor(Math.random() * 4);
        let x = Math.floor(Math.random() * 7) + 3; // valor de x entre 3 y 9
        let equation = "";
        let hint = "";

        if (subtype === 0) {
            // ax + b = c
            const a = Math.floor(Math.random() * 4) + 2; // 2-5
            const b = Math.floor(Math.random() * 12) + 2;
            const c = a * x + b;
            equation = `${a}x + ${b} = ${c}`;
            hint = `Resta ${b} a ambos lados (${c} - ${b} = ${c - b}), luego divide entre ${a}.`;
        } else if (subtype === 1) {
            // ax - b = c
            const a = Math.floor(Math.random() * 4) + 2;
            const b = Math.floor(Math.random() * 10) + 3;
            const c = a * x - b;
            equation = `${a}x - ${b} = ${c}`;
            hint = `Suma ${b} a ambos lados (${c} + ${b} = ${c + b}), luego divide entre ${a}.`;
        } else if (subtype === 2) {
            // x/a + b = c
            const a = [2, 3, 4][Math.floor(Math.random() * 3)];
            x = a * (Math.floor(Math.random() * 6) + 2); // múltiplo de a
            const b = Math.floor(Math.random() * 6) + 2;
            const c = (x / a) + b;
            equation = `\\frac{x}{${a}} + ${b} = ${c}`;
            hint = `Resta ${b} (${c} - ${b} = ${c - b}), luego multiplica el resultado por ${a}.`;
        } else {
            // a(x + b) = c
            const a = [2, 3][Math.floor(Math.random() * 2)];
            const b = Math.floor(Math.random() * 4) + 1;
            const c = a * (x + b);
            equation = `${a}(x + ${b}) = ${c}`;
            hint = `Divide primero entre ${a}: x + ${b} = ${c / a}. Luego resta ${b}.`;
        }

        const distractors = generateIntegerDistractors(x, 3);
        const options = shuffle([x.toString(), ...distractors.map(d => d.toString())]);

        return {
            topic: "Ecuaciones",
            prompt: "Encuentra el valor de la incógnita x:",
            equation: equation,
            options: options,
            answer: x.toString(),
            hint: hint
        };
    }

    // NIVEL 4 — GEOMETRÍA
    function generateLevel4() {
        const subtype = Math.floor(Math.random() * 3);
        let topic = "Geometría";

        if (subtype === 0) {
            // Pitágoras con triples conocidos
            const triples = [
                { a: 3, b: 4, c: 5, askHyp: true },
                { a: 6, b: 8, c: 10, askHyp: true },
                { a: 5, b: 12, c: 13, askHyp: true },
                { a: 8, b: 15, c: 17, askHyp: true },
                { a: 3, b: 4, c: 5, askHyp: false, unknown: 'b' },
                { a: 6, b: 8, c: 10, askHyp: false, unknown: 'a' },
                { a: 5, b: 12, c: 13, askHyp: false, unknown: 'a' }
            ];
            const item = triples[Math.floor(Math.random() * triples.length)];

            if (item.askHyp) {
                const answer = item.c.toString();
                const distractors = generateIntegerDistractors(item.c, 3);
                return {
                    topic: topic,
                    prompt: `Por Pitágoras (a² + b² = c²): Catetos a = ${item.a}, b = ${item.b}. ¿Hipotenusa c?`,
                    equation: `c = \\sqrt{${item.a}^2 + ${item.b}^2}`,
                    options: shuffle([answer, ...distractors.map(d => d.toString())]),
                    answer: answer,
                    hint: `Calcula ${item.a}² (${item.a * item.a}) + ${item.b}² (${item.b * item.b}) = ${item.c * item.c}. La raíz cuadrada es ${item.c}.`
                };
            } else {
                const answer = (item.unknown === 'a' ? item.a : item.b).toString();
                const known = item.unknown === 'a' ? item.b : item.a;
                const distractors = generateIntegerDistractors(parseInt(answer), 3);
                return {
                    topic: topic,
                    prompt: `Por Pitágoras: Hipotenusa c = ${item.c} y cateto = ${known}. ¿El otro cateto?`,
                    equation: `\\text{cateto} = \\sqrt{${item.c}^2 - ${known}^2}`,
                    options: shuffle([answer, ...distractors.map(d => d.toString())]),
                    answer: answer,
                    hint: `Resta los cuadrados: ${item.c}² (${item.c * item.c}) - ${known}² (${known * known}) = ${parseInt(answer) * parseInt(answer)}.`
                };
            }
        } else if (subtype === 1) {
            // Ángulos y propiedades de triángulos
            const pool = [
                {
                    q: "¿Cuánto suman siempre los tres ángulos interiores de cualquier triángulo?",
                    eq: "\\angle A + \\angle B + \\angle C = ?",
                    ans: "180°",
                    bad: ["90°", "360°", "270°"],
                    h: "En geometría euclidiana, la suma de los ángulos de todo triángulo es exactamente 180°."
                },
                {
                    q: "¿Cuánto suman dos ángulos complementarios?",
                    eq: "\\alpha + \\beta = 90^\\circ",
                    ans: "90°",
                    bad: ["180°", "360°", "45°"],
                    h: "Los ángulos complementarios suman un ángulo recto (90°)."
                },
                {
                    q: "¿Cuánto suman dos ángulos suplementarios?",
                    eq: "\\alpha + \\beta = 180^\\circ",
                    ans: "180°",
                    bad: ["90°", "360°", "270°"],
                    h: "Los ángulos suplementarios forman una línea recta completa (180°)."
                },
                {
                    q: "Dos ángulos de un triángulo miden 60° y 70°. ¿Cuánto mide el tercer ángulo?",
                    eq: "180^\\circ - (60^\\circ + 70^\\circ) = ?",
                    ans: "50°",
                    bad: ["40°", "60°", "70°"],
                    h: "180° - 130° = 50°."
                },
                {
                    q: "En un triángulo rectángulo, un ángulo agudo mide 35°. ¿Cuánto mide el otro?",
                    eq: "90^\\circ - 35^\\circ = ?",
                    ans: "55°",
                    bad: ["45°", "65°", "35°"],
                    h: "Los dos ángulos agudos deben sumar 90°: 90° - 35° = 55°."
                },
                {
                    q: "En un triángulo rectángulo, un ángulo agudo mide 40°. ¿Cuánto mide el otro?",
                    eq: "90^\\circ - 40^\\circ = ?",
                    ans: "50°",
                    bad: ["40°", "60°", "140°"],
                    h: "90° - 40° = 50°."
                }
            ];
            const item = pool[Math.floor(Math.random() * pool.length)];
            return {
                topic: topic,
                prompt: item.q,
                equation: item.eq,
                options: shuffle([item.ans, ...item.bad]),
                answer: item.ans,
                hint: item.h
            };
        } else {
            // Áreas y perímetros básicos
            const pool = [
                {
                    q: "Área de un triángulo con base = 10 y altura = 6:",
                    eq: "A = \\frac{b \\times h}{2} = \\frac{10 \\times 6}{2}",
                    ans: "30",
                    bad: ["60", "16", "20"],
                    h: "(10 × 6) ÷ 2 = 60 ÷ 2 = 30."
                },
                {
                    q: "Área de un triángulo con base = 8 y altura = 5:",
                    eq: "A = \\frac{8 \\times 5}{2}",
                    ans: "20",
                    bad: ["40", "26", "13"],
                    h: "(8 × 5) ÷ 2 = 40 ÷ 2 = 20."
                },
                {
                    q: "Perímetro de un triángulo equilátero de lado 7 cm:",
                    eq: "P = 3 \\times 7",
                    ans: "21 cm",
                    bad: ["14 cm", "28 cm", "49 cm"],
                    h: "El triángulo equilátero tiene sus 3 lados iguales: 7 + 7 + 7 = 21."
                },
                {
                    q: "Perímetro de un triángulo equilátero de lado 9 cm:",
                    eq: "P = 3 \\times 9",
                    ans: "27 cm",
                    bad: ["18 cm", "81 cm", "36 cm"],
                    h: "3 × 9 = 27."
                }
            ];
            const item = pool[Math.floor(Math.random() * pool.length)];
            return {
                topic: topic,
                prompt: item.q,
                equation: item.eq,
                options: shuffle([item.ans, ...item.bad]),
                answer: item.ans,
                hint: item.h
            };
        }
    }

    // NIVEL 5 — MIXTO (El más difícil y veloz)
    function generateLevel5() {
        const poolType = Math.floor(Math.random() * 4);

        if (poolType === 0) {
            // Jerarquía de operaciones compleja
            const ops = [
                { eq: "(15 - 5) \\times 3 + 2", ans: 32, bad: [35, 40, 28], h: "Primero el paréntesis (10), luego multiplica por 3 (30), y suma 2 (32)." },
                { eq: "4 + 5 \\times 6", ans: 34, bad: [54, 30, 29], h: "La multiplicación tiene prioridad: 5 × 6 = 30, luego 4 + 30 = 34." },
                { eq: "30 - 4 \\times 5 + 6", ans: 16, bad: [20, 26, 12], h: "4 × 5 = 20. Luego 30 - 20 = 10, y 10 + 6 = 16." },
                { eq: "2 \\times (8 + 7) - 10", ans: 20, bad: [25, 15, 30], h: "Paréntesis (15) × 2 = 30. Luego 30 - 10 = 20." },
                { eq: "18 \\div 3 + 4 \\times 5", ans: 26, bad: [50, 22, 32], h: "18 ÷ 3 = 6; 4 × 5 = 20. Luego 6 + 20 = 26." }
            ];
            const item = ops[Math.floor(Math.random() * ops.length)];
            return {
                topic: "Jerarquía de Operaciones",
                prompt: "Aplica la prioridad de cálculo (PEMDAS):",
                equation: `${item.eq} = ?`,
                options: shuffle([item.ans.toString(), ...item.bad.map(b => b.toString())]),
                answer: item.ans.toString(),
                hint: item.h
            };
        } else if (poolType === 1) {
            // Ecuaciones avanzadas
            const eqList = [
                { eq: "3(x - 2) = 21", ans: 9, bad: [7, 8, 11], h: "x - 2 = 21 ÷ 3 = 7. Luego x = 7 + 2 = 9." },
                { eq: "4x + 7 = 35", ans: 7, bad: [6, 8, 9], h: "4x = 35 - 7 = 28. Luego x = 28 ÷ 4 = 7." },
                { eq: "5x - 8 = 32", ans: 8, bad: [6, 7, 9], h: "5x = 32 + 8 = 40. Luego x = 40 ÷ 5 = 8." },
                { eq: "6x + 9 = 45", ans: 6, bad: [5, 7, 8], h: "6x = 45 - 9 = 36. Luego x = 36 ÷ 6 = 6." }
            ];
            const item = eqList[Math.floor(Math.random() * eqList.length)];
            return {
                topic: "Ecuaciones Rápidas",
                prompt: "Despeja x con rapidez:",
                equation: item.eq,
                options: shuffle([item.ans.toString(), ...item.bad.map(b => b.toString())]),
                answer: item.ans.toString(),
                hint: item.h
            };
        } else if (poolType === 2) {
            // Porcentajes combinados
            const pctList = [
                { q: "¿Cuánto es el 15% de 80?", eq: "15\\% \\times 80", ans: 12, bad: [8, 15, 16], h: "10% es 8, 5% es 4. Suma 8 + 4 = 12." },
                { q: "¿Cuánto es el 75% de 120?", eq: "75\\% \\times 120", ans: 90, bad: [80, 85, 100], h: "Tres cuartas partes: (120 ÷ 4) × 3 = 30 × 3 = 90." },
                { q: "¿Cuánto es el 40% de 150?", eq: "40\\% \\times 150", ans: 60, bad: [50, 70, 55], h: "10% es 15; 15 × 4 = 60." }
            ];
            const item = pctList[Math.floor(Math.random() * pctList.length)];
            return {
                topic: "Porcentajes Relámpago",
                prompt: item.q,
                equation: item.eq,
                options: shuffle([item.ans.toString(), ...item.bad.map(b => b.toString())]),
                answer: item.ans.toString(),
                hint: item.h
            };
        } else {
            // Geometría rápida
            return generateLevel4();
        }
    }

    function getQuestionForLevel(lvl) {
        switch(lvl) {
            case 1: return generateLevel1();
            case 2: return generateLevel2();
            case 3: return generateLevel3();
            case 4: return generateLevel4();
            case 5:
            default: return generateLevel5();
        }
    }

    /* --------------------------------------------------------------------------
       Objeto Principal: DuelGame
       -------------------------------------------------------------------------- */
    const DuelGame = {
        name: 'Duelo Matemático',
        icon: '⚔️',
        topic: 'mixed',
        screenId: 'screen-duel',

        level: 1,
        isRunning: false,
        isTurnActive: false,

        // Estado del combate
        playerHp: PLAYER_MAX_HP,
        enemyHp: 60,
        enemyMaxHp: 60,
        hasShield: false,
        comboStreak: 0,
        maxComboStreak: 0,
        totalDamageDealt: 0,

        // Temporizador de turno
        turnDuration: 6.0,
        turnTimeRemaining: 6.0,
        turnTimerInterval: null,
        turnStartTimestamp: 0,

        // Reto actual
        currentQuestion: null,
        hintUsedThisTurn: false,

        // Animaciones en Canvas
        canvas: null,
        ctx: null,
        animFrameId: null,
        particles: [],
        projectiles: [],
        floatingTexts: [],
        arenaTime: 0,
        screenShake: 0,

        // Referencias a elementos del DOM
        dom: {},

        /* ----------------------------------------------------------------------
           Inicialización del Módulo
           ---------------------------------------------------------------------- */
        init: function() {
            this.cacheDom();
            this.bindEvents();
            console.log('[Duelo Matemático] Módulo táctico 1v1 inicializado.');
        },

        cacheDom: function() {
            this.dom = {
                screen: document.getElementById('screen-duel'),
                overlayWelcome: document.getElementById('duel-overlay'),
                overlayEnd: document.getElementById('duel-end-overlay'),
                btnStartGame: document.getElementById('btn-start-duel-game'),
                btnNextLevel: document.getElementById('btn-duel-next-level'),
                btnRetry: document.getElementById('btn-duel-retry'),
                btnBackMap: document.getElementById('btn-duel-map'),
                btnRestartSidebar: document.getElementById('btn-restart-duel'),
                btnUseHintSidebar: document.getElementById('btn-use-hint-duel'),

                // Sidebar
                levelDisplay: document.getElementById('duel-level-display'),
                enemyHpDisplay: document.getElementById('duel-enemy-hp-display'),
                comboDisplay: document.getElementById('duel-combo-display'),
                shieldDisplay: document.getElementById('duel-shield-display'),
                equationBox: document.getElementById('duel-equation'),
                heartsBox: document.getElementById('duel-hearts-box'),

                // HUD Arena
                playerAvatar: document.getElementById('duel-hud-player-avatar'),
                enemyAvatar: document.getElementById('duel-hud-enemy-avatar'),
                playerHpBar: document.getElementById('duel-hud-player-hp-bar'),
                enemyHpBar: document.getElementById('duel-hud-enemy-hp-bar'),
                playerHpText: document.getElementById('duel-hud-player-hp-text'),
                enemyHpText: document.getElementById('duel-hud-enemy-hp-text'),
                playerShieldBadge: document.getElementById('duel-hud-player-shield'),
                comboBadge: document.getElementById('duel-hud-combo-badge'),
                timerBar: document.getElementById('duel-turn-timer-bar'),
                timerText: document.getElementById('duel-turn-timer-text'),

                // Turn Area
                topicBadge: document.getElementById('duel-question-topic-badge'),
                promptText: document.getElementById('duel-question-prompt'),
                equationDisplay: document.getElementById('duel-question-equation'),
                answersGrid: document.getElementById('duel-answers-grid'),
                turnFeedback: document.getElementById('duel-turn-feedback'),

                // End Overlay Stats
                endIcon: document.getElementById('duel-end-icon'),
                endTitle: document.getElementById('duel-end-title'),
                endMessage: document.getElementById('duel-end-message'),
                endStatLevel: document.getElementById('duel-end-stat-level'),
                endStatDamage: document.getElementById('duel-end-stat-damage'),
                endStatCombo: document.getElementById('duel-end-stat-combo'),
                endStatCoins: document.getElementById('duel-end-stat-coins'),

                // Canvas
                canvas: document.getElementById('duel-canvas')
            };

            if (this.dom.canvas) {
                this.canvas = this.dom.canvas;
                this.ctx = this.canvas.getContext('2d');
            }
        },

        bindEvents: function() {
            if (this.dom.btnStartGame) {
                this.dom.btnStartGame.addEventListener('click', () => {
                    if (window.SoundEngine) window.SoundEngine.playClick();
                    if (this.dom.overlayWelcome) this.dom.overlayWelcome.classList.add('hidden');
                    this.startTurn();
                });
            }

            if (this.dom.btnRestartSidebar) {
                this.dom.btnRestartSidebar.addEventListener('click', () => {
                    if (window.SoundEngine) window.SoundEngine.playClick();
                    this.start(this.level);
                });
            }

            if (this.dom.btnNextLevel) {
                this.dom.btnNextLevel.addEventListener('click', () => {
                    if (window.SoundEngine) window.SoundEngine.playClick();
                    if (this.dom.overlayEnd) this.dom.overlayEnd.classList.add('hidden');
                    if (this.level < 5) {
                        this.start(this.level + 1);
                    } else {
                        // Campeón supremo: volver al mapa
                        const backBtn = document.getElementById('btn-back-menu');
                        if (backBtn) backBtn.click();
                    }
                });
            }

            if (this.dom.btnRetry) {
                this.dom.btnRetry.addEventListener('click', () => {
                    if (window.SoundEngine) window.SoundEngine.playClick();
                    if (this.dom.overlayEnd) this.dom.overlayEnd.classList.add('hidden');
                    this.start(this.level);
                });
            }

            if (this.dom.btnBackMap) {
                this.dom.btnBackMap.addEventListener('click', () => {
                    if (window.SoundEngine) window.SoundEngine.playClick();
                    if (this.dom.overlayEnd) this.dom.overlayEnd.classList.add('hidden');
                    const backBtn = document.getElementById('btn-back-menu');
                    if (backBtn) backBtn.click();
                });
            }

            // Atajos de teclado (1, 2, 3, 4) para responder rápidamente
            window.addEventListener('keydown', (e) => {
                if (!this.isRunning || !this.isTurnActive) return;
                const activeGame = window.state ? window.state.activeGameScreen : null;
                if (activeGame !== 'duel') return;

                const key = e.key;
                if (['1', '2', '3', '4'].includes(key)) {
                    const idx = parseInt(key) - 1;
                    const buttons = this.dom.answersGrid ? this.dom.answersGrid.querySelectorAll('.duel-answer-btn:not(.eliminated)') : [];
                    // Mapear al índice visible
                    const allButtons = this.dom.answersGrid ? this.dom.answersGrid.querySelectorAll('.duel-answer-btn') : [];
                    if (allButtons[idx] && !allButtons[idx].disabled && !allButtons[idx].classList.contains('eliminated')) {
                        allButtons[idx].click();
                    }
                }
            });
        },

        /* ----------------------------------------------------------------------
           Ciclo de Vida: start(level) y stop()
           ---------------------------------------------------------------------- */
        start: function(lvl) {
            this.stop();

            this.level = Math.min(5, Math.max(1, parseInt(lvl) || 1));
            this.isRunning = true;
            this.isTurnActive = false;

            // Configurar stats del combate
            this.enemyMaxHp = BOSS_HP[this.level] || 60;
            this.enemyHp = this.enemyMaxHp;
            this.playerHp = PLAYER_MAX_HP;
            this.hasShield = false;
            this.comboStreak = 0;
            this.maxComboStreak = 0;
            this.totalDamageDealt = 0;
            this.turnDuration = TURN_TIME[this.level] || 6.0;

            // Ocultar fin de partida si estaba abierto
            if (this.dom.overlayEnd) this.dom.overlayEnd.classList.add('hidden');

            // Actualizar interfaz completa
            this.updateAllHUD();

            // Limpiar canvas y arrays de efectos
            this.particles = [];
            this.projectiles = [];
            this.floatingTexts = [];
            this.screenShake = 0;

            // Iniciar bucle de animación visual en canvas
            this.startCanvasLoop();

            // Mostrar u ocultar pantalla de bienvenida
            if (this.dom.overlayWelcome) {
                const title = document.getElementById('duel-overlay-title');
                const text = document.getElementById('duel-overlay-text');
                const btn = document.getElementById('btn-start-duel-game');
                if (title) title.innerText = `⚔️ Duelo Matemático — Nivel ${this.level} ⚔️`;
                if (text) text.innerText = `Mateo cuenta con ${this.enemyMaxHp} HP y el tiempo de respuesta es de ${this.turnDuration}s.`;
                if (btn) btn.innerText = "¡Iniciar Duelo!";
                this.dom.overlayWelcome.classList.remove('hidden');
            } else {
                this.startTurn();
            }

            console.log(`[Duelo Matemático] Iniciado nivel ${this.level} contra Mateo (${this.enemyMaxHp} HP)`);
        },

        stop: function() {
            this.isRunning = false;
            this.isTurnActive = false;
            this.stopTurnTimer();

            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }

            if (this.dom.turnFeedback) {
                this.dom.turnFeedback.classList.add('hidden');
            }

            console.log('[Duelo Matemático] Detenido');
        },

        /* ----------------------------------------------------------------------
           Sistema de Pistas (useHint)
           ---------------------------------------------------------------------- */
        useHint: function() {
            if (!this.isRunning || !this.isTurnActive) {
                if (window.showToast) window.showToast("💡 Espera a que comience un turno activo de combate.");
                return false;
            }

            if (this.hintUsedThisTurn) {
                if (window.showToast) window.showToast("💡 Ya has utilizado una pista en este turno.");
                return false;
            }

            if (!this.currentQuestion) return false;

            // Descartar hasta 2 opciones erróneas de las 4 disponibles
            const buttons = Array.from(this.dom.answersGrid.querySelectorAll('.duel-answer-btn:not(.eliminated)'));
            let eliminatedCount = 0;

            for (const btn of buttons) {
                if (btn.getAttribute('data-answer') !== this.currentQuestion.answer) {
                    btn.classList.add('eliminated');
                    btn.disabled = true;
                    eliminatedCount++;
                    if (eliminatedCount >= 2) break;
                }
            }

            // Mostrar pista conceptual en la caja de la ecuación
            const hintText = this.currentQuestion.hint || "Descarta respuestas que no encajan por orden de magnitud.";
            if (this.dom.equationBox) {
                this.dom.equationBox.innerHTML += `<div style="margin-top:6px; font-size:0.85rem; color:var(--color-accent-gold); border-top:1px dashed rgba(255,255,255,0.2); padding-top:4px;">💡 Pista: ${hintText}</div>`;
            }

            if (window.showToast) {
                window.showToast(`💡 Pista activada: ${hintText}`);
            }

            this.hintUsedThisTurn = true;
            return true;
        },

        /* ----------------------------------------------------------------------
           Mecánica de Turnos y Combate
           ---------------------------------------------------------------------- */
        startTurn: function() {
            if (!this.isRunning) return;

            this.isTurnActive = true;
            this.hintUsedThisTurn = false;

            // Ocultar feedback previo
            if (this.dom.turnFeedback) {
                this.dom.turnFeedback.classList.add('hidden');
                this.dom.turnFeedback.className = 'duel-turn-feedback hidden';
            }

            // Generar nuevo desafío según el nivel
            this.currentQuestion = getQuestionForLevel(this.level);

            // Renderizar la pregunta en la UI
            this.renderQuestion();

            // Iniciar temporizador del turno
            this.startTurnTimer();
        },

        renderQuestion: function() {
            if (!this.currentQuestion) return;

            const q = this.currentQuestion;

            // Actualizar etiquetas y título
            if (this.dom.topicBadge) {
                this.dom.topicBadge.innerText = q.topic.toUpperCase();
            }
            if (this.dom.promptText) {
                this.dom.promptText.innerText = q.prompt;
            }

            // Renderizar la ecuación con KaTeX si está disponible
            if (this.dom.equationDisplay) {
                if (window.renderLaTeX && (q.equation.includes('\\') || q.equation.includes('^') || q.equation.includes('_'))) {
                    window.renderLaTeX(q.equation, this.dom.equationDisplay);
                } else {
                    this.dom.equationDisplay.innerText = q.equation;
                }
            }

            // Sincronizar con el sidebar
            if (this.dom.equationBox) {
                if (window.renderLaTeX && (q.equation.includes('\\') || q.equation.includes('^'))) {
                    window.renderLaTeX(q.equation, this.dom.equationBox);
                } else {
                    this.dom.equationBox.innerText = q.equation;
                }
            }

            // Generar los 4 botones de respuesta interactivos
            if (this.dom.answersGrid) {
                this.dom.answersGrid.innerHTML = '';
                q.options.forEach((opt, idx) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'duel-answer-btn';
                    btn.setAttribute('data-answer', opt);
                    btn.id = `duel-answer-btn-${idx + 1}`;
                    
                    // Renderizar texto u opción matemática
                    btn.innerHTML = `<span style="opacity: 0.6; font-size: 0.85rem; margin-right: 6px;">[${idx + 1}]</span> ${opt}`;

                    btn.addEventListener('click', () => {
                        this.handlePlayerAnswer(opt, btn);
                    });

                    this.dom.answersGrid.appendChild(btn);
                });
            }
        },

        startTurnTimer: function() {
            this.stopTurnTimer();

            this.turnTimeRemaining = this.turnDuration;
            this.turnStartTimestamp = performance.now();
            this.updateTimerUI(this.turnDuration, this.turnDuration);

            this.turnTimerInterval = setInterval(() => {
                if (!this.isRunning || !this.isTurnActive) return;

                const elapsed = (performance.now() - this.turnStartTimestamp) / 1000;
                this.turnTimeRemaining = Math.max(0, this.turnDuration - elapsed);

                this.updateTimerUI(this.turnTimeRemaining, this.turnDuration);

                if (this.turnTimeRemaining <= 0) {
                    this.stopTurnTimer();
                    this.handleTurnTimeout();
                }
            }, 50);
        },

        stopTurnTimer: function() {
            if (this.turnTimerInterval) {
                clearInterval(this.turnTimerInterval);
                this.turnTimerInterval = null;
            }
        },

        updateTimerUI: function(current, max) {
            const pct = Math.max(0, Math.min(100, (current / max) * 100));
            if (this.dom.timerBar) {
                this.dom.timerBar.style.width = `${pct}%`;
                this.dom.timerBar.classList.remove('warning', 'danger');
                if (pct <= 30) {
                    this.dom.timerBar.classList.add('danger');
                } else if (pct <= 55) {
                    this.dom.timerBar.classList.add('warning');
                }
            }
            if (this.dom.timerText) {
                this.dom.timerText.innerText = `⏱️ ${current.toFixed(1)}s`;
            }
        },

        /* ----------------------------------------------------------------------
           Resolución de Respuestas: Acierto, Fallo y Ataques
           ---------------------------------------------------------------------- */
        handlePlayerAnswer: function(selectedOpt, clickedBtn) {
            if (!this.isRunning || !this.isTurnActive) return;

            this.isTurnActive = false;
            this.stopTurnTimer();

            // Deshabilitar botones para evitar clics dobles
            const allBtns = this.dom.answersGrid.querySelectorAll('.duel-answer-btn');
            allBtns.forEach(b => b.disabled = true);

            const isCorrect = (selectedOpt === this.currentQuestion.answer);

            if (isCorrect) {
                // ACIERTO: Ataque del jugador
                if (clickedBtn) clickedBtn.classList.add('correct');

                this.comboStreak++;
                if (this.comboStreak > this.maxComboStreak) {
                    this.maxComboStreak = this.comboStreak;
                }

                // Cálculo del combo multiplicador
                let multiplier = 1.0;
                if (this.comboStreak === 2) multiplier = 1.2;
                else if (this.comboStreak === 3) multiplier = 1.5;
                else if (this.comboStreak >= 4) multiplier = 2.0;

                const damage = Math.round(BASE_PLAYER_DAMAGE * multiplier);
                this.totalDamageDealt += damage;
                this.enemyHp = Math.max(0, this.enemyHp - damage);

                // Activar escudo protector para el siguiente ataque enemigo
                this.hasShield = true;

                if (window.SoundEngine) {
                    window.SoundEngine.playCorrect();
                    if (typeof window.SoundEngine.playLaser === 'function') {
                        window.SoundEngine.playLaser();
                    }
                }

                // Disparar proyectil mágico de ataque en el Canvas
                this.spawnProjectile('player', damage, multiplier > 1.0);

                // Feedback textual
                this.showFeedback(
                    `⚔️ ¡Ataque Certero! Infliges ${damage} de daño a Mateo. ${multiplier > 1.0 ? `(¡Combo ×${multiplier}!) ` : ''}🛡️ ¡Escudo activado!`,
                    'success'
                );

                this.updateAllHUD();

                // Verificar si Mateo fue derrotado
                setTimeout(() => {
                    if (!this.isRunning) return;
                    if (this.enemyHp <= 0) {
                        this.triggerVictory();
                    } else {
                        this.startTurn();
                    }
                }, 950);

            } else {
                // FALLO: Mateo contraataca
                if (clickedBtn) clickedBtn.classList.add('wrong');

                // Marcar la respuesta correcta en verde
                allBtns.forEach(b => {
                    if (b.getAttribute('data-answer') === this.currentQuestion.answer) {
                        b.classList.add('correct');
                    }
                });

                this.handleEnemyAttack("¡Respuesta incorrecta!");
            }
        },

        handleTurnTimeout: function() {
            if (!this.isRunning || !this.isTurnActive) return;

            this.isTurnActive = false;
            this.stopTurnTimer();

            // Deshabilitar botones
            const allBtns = this.dom.answersGrid.querySelectorAll('.duel-answer-btn');
            allBtns.forEach(b => {
                b.disabled = true;
                if (b.getAttribute('data-answer') === this.currentQuestion.answer) {
                    b.classList.add('correct');
                }
            });

            this.handleEnemyAttack("¡Se agotó el tiempo del turno!");
        },

        handleEnemyAttack: function(reasonMessage) {
            // Reiniciar combo
            this.comboStreak = 0;

            const baseEnemyDmg = (this.level >= 4) ? 25 : 20;
            let finalDamage = baseEnemyDmg;
            let shieldAbsorbed = 0;

            if (this.hasShield) {
                // El escudo absorbe el 50% del daño
                shieldAbsorbed = Math.floor(baseEnemyDmg / 2);
                finalDamage = baseEnemyDmg - shieldAbsorbed;
                this.hasShield = false; // El escudo se rompe al absorber
            }

            this.playerHp = Math.max(0, this.playerHp - finalDamage);

            if (window.SoundEngine) {
                window.SoundEngine.playWrong();
            }

            // Disparar proyectil enemigo en el Canvas
            this.spawnProjectile('enemy', finalDamage, false, shieldAbsorbed > 0);

            // Mensaje de feedback
            if (shieldAbsorbed > 0) {
                this.showFeedback(
                    `💥 ${reasonMessage} Mateo ataca, pero tu 🛡️ Escudo absorbió ${shieldAbsorbed} de daño. Recibes ${finalDamage} HP de impacto.`,
                    'error'
                );
            } else {
                this.showFeedback(
                    `💥 ${reasonMessage} Mateo contraataca y te inflige ${finalDamage} HP de daño.`,
                    'error'
                );
            }

            this.updateAllHUD();

            setTimeout(() => {
                if (!this.isRunning) return;
                if (this.playerHp <= 0) {
                    this.triggerDefeat();
                } else {
                    this.startTurn();
                }
            }, 1050);
        },

        showFeedback: function(text, type) {
            if (!this.dom.turnFeedback) return;
            this.dom.turnFeedback.innerText = text;
            this.dom.turnFeedback.className = `duel-turn-feedback ${type}`;
            this.dom.turnFeedback.classList.remove('hidden');
        },

        /* ----------------------------------------------------------------------
           Actualización de HUD y Estado
           ---------------------------------------------------------------------- */
        updateAllHUD: function() {
            // HP Jugador
            const playerPct = Math.max(0, Math.min(100, (this.playerHp / PLAYER_MAX_HP) * 100));
            if (this.dom.playerHpBar) {
                this.dom.playerHpBar.style.width = `${playerPct}%`;
            }
            if (this.dom.playerHpText) {
                this.dom.playerHpText.innerText = `${this.playerHp} / ${PLAYER_MAX_HP} HP`;
            }
            if (this.dom.heartsBox) {
                this.dom.heartsBox.innerText = `${this.playerHp} / ${PLAYER_MAX_HP} HP`;
                this.dom.heartsBox.style.color = this.playerHp > 50 ? '#10b981' : (this.playerHp > 25 ? '#f59e0b' : '#ef4444');
            }

            // Escudo del jugador
            if (this.dom.playerShieldBadge) {
                if (this.hasShield) {
                    this.dom.playerShieldBadge.classList.remove('hidden');
                } else {
                    this.dom.playerShieldBadge.classList.add('hidden');
                }
            }
            if (this.dom.shieldDisplay) {
                this.dom.shieldDisplay.innerText = this.hasShield ? "🛡️ Activo (50%)" : "Inactivo";
                this.dom.shieldDisplay.style.color = this.hasShield ? "#60a5fa" : "var(--color-text-muted)";
            }

            // HP Mateo
            const enemyPct = Math.max(0, Math.min(100, (this.enemyHp / this.enemyMaxHp) * 100));
            if (this.dom.enemyHpBar) {
                this.dom.enemyHpBar.style.width = `${enemyPct}%`;
            }
            if (this.dom.enemyHpText) {
                this.dom.enemyHpText.innerText = `${this.enemyHp} / ${this.enemyMaxHp} HP`;
            }
            if (this.dom.enemyHpDisplay) {
                this.dom.enemyHpDisplay.innerText = `${this.enemyHp} / ${this.enemyMaxHp}`;
            }

            // Combo
            let mult = 1.0;
            if (this.comboStreak === 2) mult = 1.2;
            else if (this.comboStreak === 3) mult = 1.5;
            else if (this.comboStreak >= 4) mult = 2.0;

            const comboStr = `COMBO ×${mult.toFixed(1)}`;
            if (this.dom.comboBadge) {
                this.dom.comboBadge.innerText = comboStr;
                if (this.comboStreak >= 2) {
                    this.dom.comboBadge.classList.add('active-combo');
                } else {
                    this.dom.comboBadge.classList.remove('active-combo');
                }
            }
            if (this.dom.comboDisplay) {
                this.dom.comboDisplay.innerText = `×${mult.toFixed(1)}`;
            }

            // Nivel
            if (this.dom.levelDisplay) {
                this.dom.levelDisplay.innerText = this.level;
            }
        },

        /* ----------------------------------------------------------------------
           Fin de la Partida: Victoria y Derrota
           ---------------------------------------------------------------------- */
        triggerVictory: function() {
            this.stop();

            if (window.SoundEngine && typeof window.SoundEngine.playFanfare === 'function') {
                window.SoundEngine.playFanfare();
            }

            // Recompensa y registro de nivel completado
            let coinsEarned = 50;
            if (typeof window.completeGameLevel === 'function') {
                coinsEarned = window.completeGameLevel('duel', this.level) || 50;
            } else if (typeof window.awardCoins === 'function') {
                coinsEarned = window.awardCoins(true, this.level);
            }

            // Actualizar overlay de fin
            if (this.dom.endIcon) this.dom.endIcon.innerText = "🏆";
            if (this.dom.endTitle) this.dom.endTitle.innerText = "¡VICTORIA ÉPICA!";
            if (this.dom.endMessage) {
                this.dom.endMessage.innerText = (this.level === 5)
                    ? "¡Has derrotado la forma definitiva de Mateo! ¡Eres el Gran Campeón Matemático de MathQuest!"
                    : `¡Has vencido a Mateo en el Nivel ${this.level} con precisión táctica!`;
            }

            if (this.dom.endStatLevel) this.dom.endStatLevel.innerText = `Nivel ${this.level}`;
            if (this.dom.endStatDamage) this.dom.endStatDamage.innerText = `${this.totalDamageDealt} HP`;
            let maxMult = 1.0;
            if (this.maxComboStreak === 2) maxMult = 1.2;
            else if (this.maxComboStreak === 3) maxMult = 1.5;
            else if (this.maxComboStreak >= 4) maxMult = 2.0;
            if (this.dom.endStatCombo) this.dom.endStatCombo.innerText = `×${maxMult.toFixed(1)}`;
            if (this.dom.endStatCoins) this.dom.endStatCoins.innerText = `+${coinsEarned} 🪙`;

            if (this.dom.btnNextLevel) {
                if (this.level < 5) {
                    this.dom.btnNextLevel.classList.remove('hidden');
                    this.dom.btnNextLevel.innerText = `Siguiente Duelo (Nivel ${this.level + 1}) ⚔️`;
                } else {
                    this.dom.btnNextLevel.classList.remove('hidden');
                    this.dom.btnNextLevel.innerText = "¡Completar Aventura! 👑";
                }
            }

            if (this.dom.overlayEnd) {
                this.dom.overlayEnd.classList.remove('hidden');
            }
        },

        triggerDefeat: function() {
            this.stop();

            if (window.SoundEngine && typeof window.SoundEngine.playExplosion === 'function') {
                window.SoundEngine.playExplosion();
            }

            if (this.dom.endIcon) this.dom.endIcon.innerText = "💀";
            if (this.dom.endTitle) this.dom.endTitle.innerText = "¡DERROTA EN LA ARENA!";
            if (this.dom.endMessage) {
                this.dom.endMessage.innerText = "Mateo ha resistido tus hechizos de cálculo. ¡Repasa tus fórmulas y vuelve a intentarlo!";
            }

            if (this.dom.endStatLevel) this.dom.endStatLevel.innerText = `Nivel ${this.level}`;
            if (this.dom.endStatDamage) this.dom.endStatDamage.innerText = `${this.totalDamageDealt} HP`;
            let maxMult = 1.0;
            if (this.maxComboStreak === 2) maxMult = 1.2;
            else if (this.maxComboStreak === 3) maxMult = 1.5;
            else if (this.maxComboStreak >= 4) maxMult = 2.0;
            if (this.dom.endStatCombo) this.dom.endStatCombo.innerText = `×${maxMult.toFixed(1)}`;
            if (this.dom.endStatCoins) this.dom.endStatCoins.innerText = "0 🪙";

            if (this.dom.btnNextLevel) {
                this.dom.btnNextLevel.classList.add('hidden');
            }

            if (this.dom.overlayEnd) {
                this.dom.overlayEnd.classList.remove('hidden');
            }
        },

        /* ----------------------------------------------------------------------
           Animación y Renderizado en Canvas 2D
           ---------------------------------------------------------------------- */
        startCanvasLoop: function() {
            if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

            const loop = (timestamp) => {
                if (!this.isRunning) return;
                this.updateCanvas(timestamp);
                this.drawCanvas();
                this.animFrameId = requestAnimationFrame(loop);
            };

            this.animFrameId = requestAnimationFrame(loop);
        },

        spawnProjectile: function(source, damage, isCritical, isShieldBlocked) {
            const startX = (source === 'player') ? 110 : 450;
            const startY = 110;
            const targetX = (source === 'player') ? 450 : 110;
            const targetY = 110;

            this.projectiles.push({
                source: source,
                x: startX,
                y: startY,
                startX: startX,
                startY: startY,
                targetX: targetX,
                targetY: targetY,
                progress: 0,
                speed: 0.055,
                damage: damage,
                isCritical: isCritical,
                isShieldBlocked: isShieldBlocked,
                color: (source === 'player') ? (isCritical ? '#f59e0b' : '#38bdf8') : '#ef4444'
            });
        },

        createSparks: function(x, y, color, count = 18) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = Math.random() * 4 + 1.5;
                this.particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    size: Math.random() * 3 + 2,
                    color: color || '#ffffff',
                    alpha: 1.0,
                    decay: Math.random() * 0.03 + 0.02
                });
            }
        },

        addFloatingText: function(text, x, y, color) {
            this.floatingTexts.push({
                text: text,
                x: x,
                y: y,
                vy: -1.4,
                alpha: 1.0,
                color: color || '#ffffff',
                decay: 0.02
            });
        },

        updateCanvas: function(timestamp) {
            this.arenaTime = timestamp * 0.003;

            if (this.screenShake > 0) {
                this.screenShake--;
            }

            // Actualizar proyectiles
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                p.progress += p.speed;

                p.x = p.startX + (p.targetX - p.startX) * p.progress;
                p.y = p.startY + Math.sin(p.progress * Math.PI) * -35;

                // Estela de partículas detrás del proyectil
                this.particles.push({
                    x: p.x + (Math.random() * 6 - 3),
                    y: p.y + (Math.random() * 6 - 3),
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: (Math.random() - 0.5) * 0.8,
                    size: Math.random() * 3 + 1.5,
                    color: p.color,
                    alpha: 0.8,
                    decay: 0.06
                });

                if (p.progress >= 1.0) {
                    // ¡Impacto en el objetivo!
                    this.screenShake = 10;
                    this.createSparks(p.targetX, p.targetY, p.color, 24);

                    if (p.source === 'player') {
                        // Daño a Mateo
                        if (this.dom.enemyAvatar) {
                            this.dom.enemyAvatar.classList.add('shake');
                            setTimeout(() => this.dom.enemyAvatar.classList.remove('shake'), 350);
                        }
                        const dmgText = p.isCritical ? `-${p.damage}! CRÍTICO` : `-${p.damage}!`;
                        this.addFloatingText(dmgText, p.targetX, p.targetY - 15, p.isCritical ? '#f59e0b' : '#ef4444');
                    } else {
                        // Daño al jugador
                        if (this.dom.playerAvatar) {
                            this.dom.playerAvatar.classList.add('shake');
                            setTimeout(() => this.dom.playerAvatar.classList.remove('shake'), 350);
                        }
                        if (p.isShieldBlocked) {
                            this.createSparks(p.targetX, p.targetY, '#3b82f6', 30);
                            this.addFloatingText(`🛡️ ¡ESCUDO! -${p.damage}`, p.targetX, p.targetY - 15, '#60a5fa');
                        } else {
                            this.addFloatingText(`-${p.damage}!`, p.targetX, p.targetY - 15, '#ef4444');
                        }
                    }

                    this.projectiles.splice(i, 1);
                }
            }

            // Actualizar partículas
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const pt = this.particles[i];
                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.alpha -= pt.decay;
                if (pt.alpha <= 0) {
                    this.particles.splice(i, 1);
                }
            }

            // Actualizar textos flotantes
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.y += ft.vy;
                ft.alpha -= ft.decay;
                if (ft.alpha <= 0) {
                    this.floatingTexts.splice(i, 1);
                }
            }
        },

        drawCanvas: function() {
            if (!this.ctx || !this.canvas) return;

            const w = this.canvas.width;
            const h = this.canvas.height;
            const ctx = this.ctx;

            ctx.save();

            // Screen shake
            if (this.screenShake > 0) {
                const dx = (Math.random() - 0.5) * this.screenShake;
                const dy = (Math.random() - 0.5) * this.screenShake;
                ctx.translate(dx, dy);
            }

            // Fondo de la arena
            ctx.clearRect(0, 0, w, h);

            // Suelo de piedra rúnica
            const gradFloor = ctx.createLinearGradient(0, 140, 0, h);
            gradFloor.addColorStop(0, 'rgba(30, 41, 59, 0.4)');
            gradFloor.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
            ctx.fillStyle = gradFloor;
            ctx.fillRect(0, 140, w, h - 140);

            // Línea de horizonte de la arena
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 140);
            ctx.lineTo(w, 140);
            ctx.stroke();

            // Círculos rúnicos mágicos en el suelo
            this.drawMagicRunes(ctx, w / 2, 175);

            // Dibujar al Jugador (Lado Izquierdo)
            const playerX = 110;
            const playerY = 110 + Math.sin(this.arenaTime * 2) * 4;
            this.drawFighter(ctx, playerX, playerY, 'player');

            // Dibujar a Mateo (Lado Derecho)
            const enemyX = 450;
            const enemyY = 110 + Math.cos(this.arenaTime * 2) * 4;
            this.drawFighter(ctx, enemyX, enemyY, 'enemy');

            // Dibujar proyectiles mágicos
            this.projectiles.forEach(p => {
                ctx.save();
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 15;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.isCritical ? 9 : 6, 0, Math.PI * 2);
                ctx.fill();

                // Núcleo blanco brillante
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // Dibujar partículas
            this.particles.forEach(pt => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, pt.alpha);
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // Dibujar textos de combate flotantes
            this.floatingTexts.forEach(ft => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, ft.alpha);
                ctx.fillStyle = ft.color;
                ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.restore();
            });

            ctx.restore();
        },

        drawMagicRunes: function(ctx, cx, cy) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, 0.4); // Perspectiva elíptica en el suelo

            // Anillo exterior
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 160, 0, Math.PI * 2);
            ctx.stroke();

            // Anillo medio giratorio
            ctx.save();
            ctx.rotate(this.arenaTime * 0.2);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 110, 0, Math.PI * 2);
            ctx.stroke();

            // Símbolos matemáticos en el suelo
            const symbols = ['+', '−', '×', '÷', '√', 'π', '∑', '∞'];
            ctx.font = '16px serif';
            ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = 0; i < symbols.length; i++) {
                const ang = (i / symbols.length) * Math.PI * 2;
                const sx = Math.cos(ang) * 110;
                const sy = Math.sin(ang) * 110;
                ctx.fillText(symbols[i], sx, sy);
            }
            ctx.restore();

            ctx.restore();
        },

        drawFighter: function(ctx, x, y, type) {
            ctx.save();

            // Sombra en el suelo
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(x, 158, 26, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            if (type === 'player') {
                // Escudo protector animado si está activo
                if (this.hasShield) {
                    ctx.save();
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 18;
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(x, y - 10, 36 + Math.sin(this.arenaTime * 6) * 2, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
                    ctx.fill();
                    ctx.restore();
                }

                // Cuerpo del héroe (Túnica azul cian)
                ctx.fillStyle = '#0284c7';
                ctx.beginPath();
                ctx.arc(x, y - 15, 22, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Rostro / Capucha
                ctx.fillStyle = '#f8fafc';
                ctx.font = '22px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🧙', x, y - 15);

                // Varita o báculo de luz
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x + 18, y + 10);
                ctx.lineTo(x + 28, y - 30);
                ctx.stroke();

                // Gema en la punta del báculo
                ctx.fillStyle = '#38bdf8';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(x + 28, y - 30, 5, 0, Math.PI * 2);
                ctx.fill();

                // Nombre sobre la cabeza
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 11px system-ui, sans-serif';
                ctx.fillText('Héroe', x, y - 44);

            } else {
                // Mateo (Jefe tenebroso)
                ctx.save();
                // Aura oscura de Mateo
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#450a0a';
                ctx.beginPath();
                ctx.arc(x, y - 15, 24, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();

                // Rostro / Emoji de Mateo
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🧙‍♂️', x, y - 15);

                // Báculo oscuro con runa de Mateo
                ctx.strokeStyle = '#7f1d1d';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(x - 18, y + 10);
                ctx.lineTo(x - 28, y - 32);
                ctx.stroke();

                // Orbe de poder oscuro en la punta
                ctx.save();
                ctx.fillStyle = '#ef4444';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(x - 28, y - 32, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Runas que orbitan a Mateo
                const orbitRune = ['∑', 'π', '√', '∞'][Math.floor(this.arenaTime * 1.5) % 4];
                const ox = x + Math.cos(this.arenaTime * 3) * 36;
                const oy = y - 15 + Math.sin(this.arenaTime * 3) * 14;
                ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
                ctx.font = 'bold 12px serif';
                ctx.fillText(orbitRune, ox, oy);

                // Nombre sobre la cabeza
                ctx.fillStyle = '#fca5a5';
                ctx.font = 'bold 11px system-ui, sans-serif';
                ctx.fillText('Mateo (Jefe)', x, y - 44);
            }

            ctx.restore();
        }
    };

    // Registro del juego en la arquitectura modular de MathQuest
    window.MathQuestGames['duel'] = DuelGame;

    // Inicializar módulo al cargar el documento
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DuelGame.init());
    } else {
        DuelGame.init();
    }
})();
