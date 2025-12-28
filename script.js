const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const playerSprite = document.getElementById('player-sprite');
const monsterSprite = document.getElementById('monster-sprite');
const hud = document.getElementById('hud');
const paperCountDisplay = document.getElementById('paper-count');

// Áudios
const audios = {
    inicial: document.getElementById('audio-inicial'),
    vinhas: document.getElementById('audio-vinhas'),
    grito: document.getElementById('audio-grito'),
    janela: document.getElementById('audio-janela'),
    passos: document.getElementById('audio-passos-monster'),
    ataque: document.getElementById('audio-monster-ataque'),
    playerDead: document.getElementById('audio-player-dead')
};

// Configuração
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gameState = 'MENU'; // MENU, DIALOGUE, PLAYING, GAMEOVER
let currentLevel = 'STREET'; // STREET, COURTYARD, ROOF, MAZE
let papersCollected = 0;
let dialogueQueue = [];
let dialogueCallback = null;
let lastCheckpoint = 'START';

// Player
const player = {
    x: 100, y: canvas.height - 150, w: 64, h: 96,
    vx: 0, vy: 0, speed: 5, jumpForce: 12, gravity: 0.6,
    grounded: false, state: 'parada', facingLeft: true,
    dead: false, crouching: false
};

// Monstro
const monster = {
    x: -200, y: 0, w: 80, h: 100, speed: 3.5, active: false, state: 'andar', facingLeft: true
};

// Inputs
const keys = { right: false, left: false, up: false, down: false, interact: false };

// Event Listeners
window.addEventListener('keydown', (e) => {
    if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
    if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
    if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
    if(e.code === 'KeyE') keys.interact = true;
});

window.addEventListener('keyup', (e) => {
    if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
    if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
    if(e.code === 'KeyE') keys.interact = false;
});

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('menu-screen').classList.add('hidden');
    fadeOutAudio(audios.inicial);
    startGame(true);
});

// Assets Paths (Helper)
const getAsset = (folder, name) => `/static/${folder}/${name}`;

// --- Engine ---

function fadeOutAudio(audio) {
    let vol = 1;
    let interval = setInterval(() => {
        if (vol > 0) {
            vol -= 0.1;
            audio.volume = Math.max(0, vol);
        } else {
            clearInterval(interval);
            audio.pause();
            audio.currentTime = 0;
        }
    }, 200);
}

function typeWriter(text, callback) {
    const el = document.getElementById('typing-text');
    const screen = document.getElementById('dialogue-screen');
    screen.classList.remove('hidden');
    el.innerHTML = '';
    gameState = 'DIALOGUE';
    
    let i = 0;
    let speed = 50; 
    
    function type() {
        if (i < text.length) {
            el.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            setTimeout(() => {
                screen.classList.add('hidden');
                gameState = 'PLAYING';
                if(callback) callback();
            }, 2000);
        }
    }
    type();
}

function startGame(fromBeginning) {
    audios.inicial.play();
    if(fromBeginning) {
        lastCheckpoint = 'START';
        currentLevel = 'STREET';
        const introText = "Parece-que-aqueles-imbecis-me-colocaram-para-pegar-a-cola-da-prova-de-novo...\nTão-estressante...\nVamos-acabar-logo-com-isso.";
        
        // Simular fade out do menu e in do jogo
        setTimeout(() => {
            typeWriter(introText, () => {
                player.x = 50;
                player.y = canvas.height - 150;
            });
        }, 1000);
    } else {
        // Reiniciar estado
        gameState = 'PLAYING';
        player.dead = false;
        playerSprite.classList.remove('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
    }
    document.getElementById('game-container').classList.remove('hidden');
    requestAnimationFrame(gameLoop);
}

function restartFromWindow() {
    lastCheckpoint = 'WINDOW';
    currentLevel = 'MAZE';
    player.dead = false;
    player.x = 100;
    player.y = canvas.height - 150;
    monster.active = true;
    monster.x = canvas.width - 200;
    papersCollected = 0;
    paperCountDisplay.innerText = "0";
    
    // Reset objects
    mazeObjects = generateMaze(); 
    
    document.getElementById('game-over-screen').classList.add('hidden');
    gameState = 'PLAYING';
    audios.passos.play();
}

// --- Levels & Logic ---

// Objetos do jogo (Plataformas, interativos)
let gameObjects = [];
let mazeObjects = [];

function loadLevel(level) {
    gameObjects = [];
    currentLevel = level;
    
    if (level === 'STREET') {
        // Chão
        gameObjects.push({type: 'platform', x: 0, y: canvas.height - 50, w: canvas.width * 2, h: 50, color: '#1a1a1a'});
        // Portão
        gameObjects.push({type: 'gate', x: 600, y: canvas.height - 250, w: 100, h: 200, interact: true, msg: "O portão está trancado"});
        // Vinhas
        gameObjects.push({type: 'vines', x: canvas.width - 150, y: canvas.height - 350, w: 100, h: 300, interact: true});
    }
    else if (level === 'COURTYARD') {
        player.x = 50;
        // Chão
        gameObjects.push({type: 'platform', x: 0, y: canvas.height - 50, w: canvas.width, h: 50, color: '#222'});
        // Porta
        gameObjects.push({type: 'door', x: 300, y: canvas.height - 250, w: 80, h: 200, interact: true, msg: "Trancada."});
        // Parkour
        gameObjects.push({type: 'platform', x: 600, y: canvas.height - 200, w: 100, h: 20, color: '#444'});
        gameObjects.push({type: 'platform', x: 750, y: canvas.height - 350, w: 100, h: 20, color: '#444'});
        gameObjects.push({type: 'platform', x: 600, y: canvas.height - 500, w: 100, h: 20, color: '#444'});
        // Trigger de topo
        gameObjects.push({type: 'trigger_roof', x: 500, y: 0, w: 300, h: 50});
    }
    else if (level === 'ROOF') {
        player.x = 100; player.y = canvas.height - 300;
        // Telhado
        gameObjects.push({type: 'platform', x: 0, y: canvas.height - 100, w: 300, h: 100, color: '#111'});
        gameObjects.push({type: 'platform', x: 400, y: canvas.height - 100, w: 600, h: 100, color: '#111'}); // Gap no meio
        // Janelas
        gameObjects.push({type: 'window1', x: 500, y: canvas.height - 250, w: 60, h: 80, interact: true});
        gameObjects.push({type: 'window2', x: 800, y: canvas.height - 250, w: 60, h: 80, interact: true, msg: "Trancada."});
    }
    else if (level === 'MAZE') {
        mazeObjects = generateMaze();
        monster.active = true;
        monster.x = canvas.width - 100;
        audios.passos.play();
        hud.classList.remove('hidden');
    }
}

function generateMaze() {
    let objs = [];
    // Chão base
    objs.push({type: 'platform', x: 0, y: canvas.height - 50, w: canvas.width * 3, h: 50, color: '#221111'});
    
    // Vasos para esconder (simples lógica: se player colide e agacha, fica invisivel)
    for(let i=0; i<4; i++) {
        objs.push({type: 'hideout', x: 300 + (i*400), y: canvas.height - 150, w: 80, h: 100});
    }
    
    // Papeis
    for(let i=0; i<15; i++) {
        objs.push({type: 'paper', x: Math.random() * (canvas.width * 2) + 200, y: canvas.height - 200, w: 30, h: 40, collected: false});
    }
    
    return objs;
}

// --- Physics & Updates ---

function checkCollision(rect1, rect2) {
    return (rect1.x < rect2.x + rect2.w &&
            rect1.x + rect1.w > rect2.x &&
            rect1.y < rect2.y + rect2.h &&
            rect1.y + rect1.h > rect2.y);
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Player Physics
    if (keys.right) { player.vx = player.speed; player.facingLeft = false; }
    else if (keys.left) { player.vx = -player.speed; player.facingLeft = true; }
    else { player.vx = 0; }

    // Pular
    if (keys.up && player.grounded) {
        player.vy = -player.jumpForce;
        player.grounded = false;
    }

    // Agachar
    if (keys.down) {
        player.crouching = true;
        player.vx = 0; // Para ao agachar
    } else {
        player.crouching = false;
    }

    player.vy += player.gravity;
    player.x += player.vx;
    player.y += player.vy;

    // Limites de tela (depende da fase)
    if (player.x < 0) player.x = 0;
    
    // Queda no buraco (Telhado)
    if (player.y > canvas.height) {
        if (currentLevel === 'ROOF') triggerDeath('fall');
    }

    // Colisão com Plataformas
    player.grounded = false;
    let list = currentLevel === 'MAZE' ? mazeObjects : gameObjects;
    
    list.forEach(obj => {
        if (obj.type === 'platform') {
            if (player.y + player.h > obj.y && player.y + player.h < obj.y + player.vy + 20 &&
                player.x + player.w > obj.x && player.x < obj.x + obj.w) {
                player.y = obj.y - player.h;
                player.vy = 0;
                player.grounded = true;
            }
        }
        
        // Coleta de Papel
        if (obj.type === 'paper' && !obj.collected) {
            if (checkCollision(player, obj)) {
                obj.collected = true;
                papersCollected++;
                paperCountDisplay.innerText = papersCollected;
                if(papersCollected >= 15) triggerEnding();
            }
        }

        // Interação
        if (keys.interact && obj.interact && checkCollision(player, obj)) {
            keys.interact = false; // Debounce
            if (obj.msg) {
                // Mostrar texto temporário no canvas ou console por simplicidade
                alert(obj.msg); // Trocar por overlay bonito se der tempo
            } else if (obj.type === 'vines') {
                transitionScene('COURTYARD', audios.vinhas, "Ufa...\nEspero-que-a-mãe-natureza-não-fique-brava-por-mim-ter-matado-umas-vinhas-no-processo.");
            } else if (obj.type === 'window1') {
                transitionScene('MAZE', audios.janela, null);
            }
        }
        
        // Trigger Roof
        if (obj.type === 'trigger_roof' && checkCollision(player, obj)) {
            transitionScene('ROOF', null, null);
        }
    });

    // Animação Player
    updatePlayerAnimation();

    // Monster Logic (Maze)
    if (currentLevel === 'MAZE' && monster.active) {
        updateMonster();
    }
}

function updateMonster() {
    // Patrulha simples: vai na direção do player
    let dx = player.x - monster.x;
    
    // Se player está escondido (colidindo com hideout e agachado)
    let isHidden = false;
    mazeObjects.forEach(obj => {
        if (obj.type === 'hideout' && checkCollision(player, obj) && player.crouching) {
            isHidden = true;
        }
    });

    if (!isHidden) {
        // Perseguir
        if (Math.abs(dx) < 600) { // Distancia de visão
            monster.x += Math.sign(dx) * monster.speed;
            monster.facingLeft = dx < 0;
        } else {
            // Random walk
            monster.x += (Math.random() - 0.5) * 2;
        }
        
        // Matar
        if (checkCollision(player, monster)) {
            triggerDeath('monster');
        }
    } else {
        // Passa reto
        monster.x += (monster.facingLeft ? -1 : 1) * monster.speed;
    }
    
    // Atualizar sprite monstro
    if (monster.active) {
        // Assumindo ataque ou andar
        let src = checkCollision(player, monster) ? 'monster/ataque.gif' : 'monster/andar.gif';
        // Atualiza src apenas se mudar para evitar recarregar gif
        if (!monsterSprite.src.includes(src)) monsterSprite.src = `/static/${src}`;
        
        monsterSprite.style.left = monster.x + 'px';
        monsterSprite.style.top = (monster.y + (canvas.height - 150)) + 'px'; // Ajuste Y
        monsterSprite.style.transform = `scaleX(${monster.facingLeft ? 1 : -1})`;
        monsterSprite.classList.remove('hidden');
    }
}

function triggerDeath(reason) {
    gameState = 'GAMEOVER';
    player.dead = true;
    audios.passos.pause();
    
    if (reason === 'monster') {
        audios.ataque.play();
        setTimeout(() => {
            audios.playerDead.play();
            playerSprite.src = getAsset('player', 'morri.gif');
            showGameOver();
        }, 500); // Tempo do hitkill
    } else {
        audios.grito.play();
        showGameOver();
    }
}

function showGameOver() {
    setTimeout(() => {
        document.getElementById('game-over-screen').classList.remove('hidden');
        if(currentLevel === 'MAZE') {
            document.getElementById('restart-window-btn').classList.remove('hidden');
        }
    }, 2000);
}

function transitionScene(nextLevel, soundEffect, text) {
    gameState = 'TRANSITION';
    const transition = () => {
        loadLevel(nextLevel);
        if (text) {
             typeWriter(text, () => gameState = 'PLAYING');
        } else {
            gameState = 'PLAYING';
        }
    };

    // Fade out visual simulation
    let fade = document.createElement('div');
    fade.style.position = 'absolute'; fade.style.top=0; fade.style.width='100%'; fade.style.height='100%'; fade.style.background='black'; fade.style.opacity=0; fade.style.transition='opacity 1s';
    document.body.appendChild(fade);
    
    setTimeout(() => fade.style.opacity = 1, 10);

    if (soundEffect) soundEffect.play();

    setTimeout(() => {
        transition();
        setTimeout(() => {
            fade.style.opacity = 0;
            setTimeout(() => fade.remove(), 1000);
        }, 1000);
    }, 2000);
}

function triggerEnding() {
    gameState = 'ENDING';
    audios.passos.pause();
    const endText = "Nunca-mais-quis-voltar-naquela-escola...\nPensei-em-contar-para-meus-colegas-o-que-vi-lá...\nMas-quem-acreditaria...?\nPra-ser-sincera...\nNem-eu-sei-o-que-vi-lá...\nFalei-para-minha-mãe-que-estava-com-problemas-na-escola...\nEla-me-tirou-daquele-lugar...\nMas-o-que-será-dos-outros-alunos...";
    
    let fade = document.createElement('div');
    fade.style.position = 'absolute'; fade.style.top=0; fade.style.width='100%'; fade.style.height='100%'; fade.style.background='black'; fade.style.zIndex=500;
    document.body.appendChild(fade);
    
    setTimeout(() => {
        typeWriter(endText, () => {
            location.reload(); // Volta ao menu
        });
    }, 1000);
}

// --- Render ---

function updatePlayerAnimation() {
    let anim = 'parada.gif';
    if (player.dead) anim = 'morri.gif';
    else if (player.crouching) anim = 'agachar.gif';
    else if (!player.grounded) anim = 'pulando.gif';
    else if (Math.abs(player.vx) > 0) anim = 'andando.gif';
    
    let fullPath = getAsset('player', anim);
    // Só troca o src se for diferente para não resetar o GIF
    if (!playerSprite.src.includes(anim)) {
        playerSprite.src = fullPath;
    }

    // Flip Horizontal (CSS) - O prompt diz que as anims olham para a esquerda nativamente
    // Se facingLeft é true, scaleX(1). Se false, scaleX(-1).
    playerSprite.style.transform = `scaleX(${player.facingLeft ? 1 : -1})`;
    
    // Sync Position
    playerSprite.style.left = player.x + 'px';
    playerSprite.style.top = player.y + 'px';
    playerSprite.style.width = player.w + 'px';
    playerSprite.style.height = player.h + 'px';
}

function draw() {
    // Limpar Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Ambiente
    if (currentLevel === 'STREET') {
        // Lua
        ctx.fillStyle = '#fffa';
        ctx.beginPath(); ctx.arc(100, 100, 40, 0.4, 1.8 * Math.PI, true); ctx.fill();
    }
    
    // Desenhar Objetos
    let list = currentLevel === 'MAZE' ? mazeObjects : gameObjects;
    list.forEach(obj => {
        if (obj.type === 'platform') {
            ctx.fillStyle = obj.color || '#333';
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'gate') {
            ctx.strokeStyle = '#555'; ctx.lineWidth = 5; ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
            // Grades
            for(let i=10; i<obj.w; i+=10) {
                ctx.beginPath(); ctx.moveTo(obj.x+i, obj.y); ctx.lineTo(obj.x+i, obj.y+obj.h); ctx.stroke();
            }
        } else if (obj.type === 'vines') {
            ctx.fillStyle = 'green';
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h); // Placeholder para vinhas
        } else if (obj.type === 'door' || obj.type.includes('window')) {
            ctx.fillStyle = '#222'; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
            ctx.strokeStyle = '#666'; ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'hideout') {
            ctx.fillStyle = '#3a2a1a'; // Vaso/Movel
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'paper' && !obj.collected) {
            ctx.fillStyle = 'white';
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        }
    });
}

function gameLoop() {
    update();
    draw();
    if (gameState !== 'MENU') requestAnimationFrame(gameLoop);
}

// Inicialização
loadLevel('STREET');