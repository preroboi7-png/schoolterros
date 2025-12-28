// --- CONFIGURAÇÃO E ASSETS ---
const assets = {
    player: {
        idle: 'player/parada.gif',
        walk: 'player/andando.gif',
        jump: 'player/pulando.gif',
        crouch: 'player/agachar.gif',
        dead: 'player/morri.gif'
    },
    monster: {
        walk: 'monster/andar.gif',
        attack: 'monster/ataque.gif'
    }
};

const sounds = {
    intro: document.getElementById('audio-inicial'),
    vinhas: document.getElementById('audio-vinhas'),
    grito: document.getElementById('audio-grito'),
    janela: document.getElementById('audio-janela'),
    passosMonster: document.getElementById('audio-passos-monster'),
    ataqueMonster: document.getElementById('audio-monster-ataque'),
    playerDead: document.getElementById('audio-player-dead')
};

// --- VARIÁVEIS DE ESTADO ---
let gameState = 'MENU'; // MENU, INTRO, PLAYING, GAMEOVER
let currentScene = 'STREET'; // STREET, COURTYARD, ROOF, MAZE
let player = {
    x: 50, y: 0, w: 60, h: 100,
    vx: 0, vy: 0, speed: 5, jumpPower: 12,
    grounded: false, facingLeft: true,
    isCrouching: false, isDead: false,
    element: null
};
let monster = {
    x: 0, y: 0, w: 80, h: 120,
    speed: 3.5, active: false,
    facingLeft: true, attacking: false,
    element: null
};
let keys = {};
let papersCollected = 0;
let totalPapers = 15;
let platforms = [];
let walls = [];
let interactables = [];
let hidingSpots = [];
let papers = [];

// --- ELEMENTOS DOM ---
const world = document.getElementById('world');
const uiPrompt = document.getElementById('interaction-prompt');
const blackScreen = document.getElementById('black-screen');
const introText = document.getElementById('intro-text');
const dialogueBox = document.getElementById('dialogue-box');

// --- INICIALIZAÇÃO ---
document.getElementById('btn-start').addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (gameState === 'PLAYING' && !player.isDead) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
            if (player.grounded && !player.isCrouching) player.vy = -player.jumpPower;
        }
        if (e.key.toLowerCase() === 'e') tryInteract();
    }
});

window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    sounds.intro.play();
    
    // Fade out audio inicial
    let vol = 1;
    let fade = setInterval(() => {
        if (vol > 0) {
            vol -= 0.05;
            sounds.intro.volume = Math.max(0, vol);
        } else {
            clearInterval(fade);
            sounds.intro.pause();
        }
    }, 200);

    gameState = 'INTRO';
    blackScreen.classList.remove('hidden');
    blackScreen.style.opacity = 1;

    // Sequência de Texto
    const text = "Parece-que-aqueles-imbecis-me-colocaram-para-pegar-a-cola-da-prova-de-novo...\nTão-estressante...\nVamos-acabar-logo-com-isso.";
    typeWriter(text, introText, () => {
        setTimeout(() => {
            blackScreen.style.opacity = 0;
            setTimeout(() => {
                blackScreen.classList.add('hidden');
                loadScene('STREET');
            }, 2000);
        }, 1000);
    });
}

function typeWriter(text, element, callback) {
    element.innerText = "";
    let i = 0;
    function type() {
        if (i < text.length) {
            element.innerText += text.charAt(i);
            i++;
            setTimeout(type, 50);
        } else if (callback) {
            callback();
        }
    }
    type();
}

function showDialogue(text, duration = 4000, callback) {
    dialogueBox.classList.remove('hidden');
    typeWriter(text, dialogueBox, () => {
        setTimeout(() => {
            dialogueBox.classList.add('hidden');
            if(callback) callback();
        }, duration);
    });
}

// --- SISTEMA DE CENAS ---
function loadScene(sceneName) {
    currentScene = sceneName;
    gameState = 'PLAYING';
    world.innerHTML = ''; // Limpa cenário
    platforms = [];
    walls = [];
    interactables = [];
    hidingSpots = [];
    papers = [];
    monster.active = false;
    monster.element = null;
    sounds.passosMonster.pause();

    // Cria Player
    player.element = document.createElement('div');
    player.element.className = 'sprite';
    player.element.style.width = player.w + 'px';
    player.element.style.height = player.h + 'px';
    world.appendChild(player.element);
    player.isDead = false;
    player.isCrouching = false;

    // Configuração Específica de cada Cena
    if (sceneName === 'STREET') {
        player.x = 50; player.y = window.innerHeight - 150;
        
        // Chão
        createPlatform(0, window.innerHeight - 50, 2000, 50);
        
        // Portão (Lógica visual apenas, não bloqueia movimento físico no 2D side scroller simples, mas tem interação)
        createInteractable(800, window.innerHeight - 150, 100, 100, 'gate');
        
        // Muro/Vinhas mais a frente
        createInteractable(1600, window.innerHeight - 250, 100, 200, 'vines');
        // Adicionar um sprite visual de muro
        let wall = document.createElement('div');
        wall.className = 'wall';
        wall.style.left = '1600px'; wall.style.bottom = '50px'; wall.style.width = '100px'; wall.style.height = '300px';
        world.appendChild(wall);
        
    } else if (sceneName === 'COURTYARD') {
        player.x = 50; player.y = window.innerHeight - 150;
        createPlatform(0, window.innerHeight - 50, 2000, 50);
        
        showDialogue("Ufa...\nEspero-que-a-mãe-natureza-não-fique-brava-por-mim-ter-matado-umas-vinhas-no-processo.");
        
        // Porta da Escola
        createInteractable(600, window.innerHeight - 150, 80, 100, 'door');
        
        // Parkour
        createPlatform(900, window.innerHeight - 200, 100, 20);
        createPlatform(1100, window.innerHeight - 350, 100, 20);
        createPlatform(1300, window.innerHeight - 500, 300, 20); // Topo
        
        // Trigger para telhado (área invisível)
        createInteractable(1400, window.innerHeight - 600, 100, 100, 'to_roof');
        
    } else if (sceneName === 'ROOF') {
        player.x = 100; player.y = window.innerHeight - 150;
        // Telhado
        createPlatform(0, window.innerHeight - 50, 1500, 50);
        
        // Janela 1 (Aberta)
        createInteractable(600, window.innerHeight - 150, 60, 80, 'window1');
        
        // Janela 2 (Trancada)
        createInteractable(1000, window.innerHeight - 150, 60, 80, 'window2');
        
        // Borda (Queda)
        createInteractable(1450, window.innerHeight - 150, 50, 100, 'jump_off');
        
    } else if (sceneName === 'MAZE') {
        player.x = 50; player.y = window.innerHeight - 150;
        document.getElementById('paper-counter').classList.remove('hidden');
        
        // Configurar Labirinto (Plataformas e Paredes)
        // Andar Térreo
        createPlatform(0, window.innerHeight - 50, 3000, 50);
        // Andar 1
        createPlatform(300, window.innerHeight - 300, 800, 20);
        createPlatform(1200, window.innerHeight - 300, 800, 20);
        
        // Esconderijos (Vasos/Armários)
        createHidingSpot(400, window.innerHeight - 150);
        createHidingSpot(1500, window.innerHeight - 150);
        createHidingSpot(500, window.innerHeight - 400); // No andar de cima
        
        // Espalhar Páginas
        for(let i=0; i<15; i++) {
            createPaper(300 + (i * 150), (i % 2 == 0 ? window.innerHeight - 100 : window.innerHeight - 350));
        }
        
        // Inicializar Monstro
        spawnMonster(2000, window.innerHeight - 170);
    }
    
    gameLoop();
}

function createPlatform(x, y, w, h) {
    let p = document.createElement('div');
    p.className = 'platform';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.width = w + 'px'; p.style.height = h + 'px';
    world.appendChild(p);
    platforms.push({x, y, w, h});
}

function createInteractable(x, y, w, h, type) {
    let i = document.createElement('div');
    i.className = 'interactable';
    i.style.left = x + 'px'; i.style.top = y + 'px';
    i.style.width = w + 'px'; i.style.height = h + 'px';
    i.dataset.type = type;
    world.appendChild(i);
    interactables.push({x, y, w, h, type});
}

function createHidingSpot(x, y) {
    let h = document.createElement('div');
    h.className = 'hiding-spot';
    h.style.left = x + 'px'; h.style.top = (y-30) + 'px'; // Ajuste visual
    h.style.width = '60px'; h.style.height = '100px'; // Tamanho do esconderijo
    world.appendChild(h);
    hidingSpots.push({x: x, y: y-30, w: 60, h: 100});
}

function createPaper(x, y) {
    let p = document.createElement('div');
    p.className = 'paper';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    world.appendChild(p);
    papers.push({x, y, w: 20, h: 25, element: p});
}

function spawnMonster(x, y) {
    monster.active = true;
    monster.x = x; monster.y = y;
    monster.element = document.createElement('div');
    monster.element.className = 'sprite';
    monster.element.style.width = monster.w + 'px';
    monster.element.style.height = monster.h + 'px';
    monster.element.style.backgroundImage = `url('${assets.monster.walk}')`;
    monster.element.style.zIndex = 10;
    world.appendChild(monster.element);
    sounds.passosMonster.play();
}

// --- GAME LOOP & FÍSICA ---
function gameLoop() {
    if (gameState !== 'PLAYING') return;

    // Física Player
    if (keys['arrowleft'] || keys['a']) {
        player.vx = -player.speed;
        player.facingLeft = true;
    } else if (keys['arrowright'] || keys['d']) {
        player.vx = player.speed;
        player.facingLeft = false;
    } else {
        player.vx = 0;
    }
    
    // Agachar e Esconder
    player.isCrouching = false;
    if ((keys['arrowdown'] || keys['s']) && player.grounded) {
        player.isCrouching = true;
        player.vx = 0; // Para de andar ao agachar
    }

    // Gravidade
    player.vy += 0.8;
    player.x += player.vx;
    player.y += player.vy;

    // Colisão Plataforma
    player.grounded = false;
    platforms.forEach(p => {
        if (player.x < p.x + p.w && player.x + player.w > p.x &&
            player.y + player.h > p.y && player.y + player.h < p.y + p.h + 20 &&
            player.vy >= 0) {
            player.grounded = true;
            player.vy = 0;
            player.y = p.y - player.h;
        }
    });

    // Limites da tela (Chão infinito para evitar cair no vazio em fases normais)
    if (player.y > window.innerHeight) {
        if (currentScene === 'ROOF') {
            triggerGameOver('falling');
            return;
        } else {
            player.y = window.innerHeight - player.h; player.vy = 0; player.grounded = true;
        }
    }

    updatePlayerAnimation();
    updateCamera();
    checkProximity();

    // Lógica do Monstro (Maze)
    if (currentScene === 'MAZE' && monster.active && !monster.attacking) {
        // AI Simples: Perseguir se não estiver escondido
        let dist = player.x - monster.x;
        let isHidden = false;
        
        if (player.isCrouching) {
            hidingSpots.forEach(spot => {
                if (checkCollision(player, spot)) isHidden = true;
            });
        }

        if (!isHidden && Math.abs(dist) < 800) {
            // Persegue
            if (dist > 0) { monster.x += monster.speed; monster.facingLeft = false; }
            else { monster.x -= monster.speed; monster.facingLeft = true; }
        } else {
            // Patrulha básica
            monster.x += (monster.facingLeft ? -2 : 2);
            if(monster.x < 0) monster.facingLeft = false;
            if(monster.x > 3000) monster.facingLeft = true;
        }

        // Colisão com Player (Hitkill)
        if (!isHidden && checkCollision(player, monster)) {
            killPlayer();
        }

        // Render Monstro
        monster.element.style.transform = `translate(${monster.x}px, ${monster.y}px) ${monster.facingLeft ? 'scaleX(1)' : 'scaleX(-1)'}`;
        
        // Coletar Papéis
        papers.forEach((p, index) => {
            if(p.element && checkCollision(player, p)) {
                p.element.remove();
                delete papers[index];
                papersCollected++;
                document.getElementById('count').innerText = papersCollected;
                if(papersCollected >= totalPapers) finishGame();
            }
        });
    }

    // Render Player
    player.element.style.transform = `translate(${player.x}px, ${player.y}px) ${player.facingLeft ? 'scaleX(1)' : 'scaleX(-1)'}`;

    requestAnimationFrame(gameLoop);
}

function updatePlayerAnimation() {
    let anim = assets.player.idle;
    if (player.isDead) anim = assets.player.dead;
    else if (player.isCrouching) anim = assets.player.crouch;
    else if (!player.grounded) anim = assets.player.jump;
    else if (Math.abs(player.vx) > 0) anim = assets.player.walk;

    if (player.element.style.backgroundImage !== `url("${anim}")`) {
        player.element.style.backgroundImage = `url("${anim}")`;
    }
}

function updateCamera() {
    // Scroll lateral simples
    let offset = player.x - window.innerWidth / 2;
    if (offset < 0) offset = 0;
    world.style.transform = `translateX(-${offset}px)`;
    // Ajustar backgrounds se necessário
}

function checkCollision(rect1, rect2) {
    if(!rect2) return false;
    return (rect1.x < rect2.x + rect2.w &&
            rect1.x + rect1.w > rect2.x &&
            rect1.y < rect2.y + rect2.h &&
            rect1.y + rect1.h > rect2.y);
}

function checkProximity() {
    let near = false;
    interactables.forEach(i => {
        let dist = Math.abs((player.x + player.w/2) - (i.x + i.w/2));
        if (dist < 80 && Math.abs((player.y) - (i.y)) < 100) {
            near = true;
            uiPrompt.classList.remove('hidden');
        }
    });
    if (!near) uiPrompt.classList.add('hidden');
}

function tryInteract() {
    interactables.forEach(i => {
        let dist = Math.abs((player.x + player.w/2) - (i.x + i.w/2));
        if (dist < 80 && Math.abs((player.y) - (i.y)) < 100) {
            handleInteraction(i.type);
        }
    });
}

function handleInteraction(type) {
    if (type === 'gate') showDialogue("O portão está trancado.");
    
    if (type === 'vines') {
        blackScreen.classList.remove('hidden');
        blackScreen.style.opacity = 1;
        sounds.vinhas.play();
        sounds.vinhas.onended = () => {
            loadScene('COURTYARD');
            blackScreen.style.opacity = 0;
            setTimeout(() => blackScreen.classList.add('hidden'), 1000);
        };
    }
    
    if (type === 'door') showDialogue("Trancada... Parece que vou ter que achar outro jeito.");
    
    if (type === 'to_roof') {
        blackScreen.classList.remove('hidden');
        blackScreen.style.opacity = 1;
        setTimeout(() => {
            loadScene('ROOF');
            blackScreen.style.opacity = 0;
            setTimeout(() => blackScreen.classList.add('hidden'), 1000);
        }, 1000);
    }
    
    if (type === 'jump_off') {
        triggerGameOver('falling');
    }
    
    if (type === 'window2') showDialogue("Essa janela não abre.");
    
    if (type === 'window1') {
        blackScreen.classList.remove('hidden');
        blackScreen.style.opacity = 1;
        sounds.janela.play();
        sounds.janela.onended = () => {
            loadScene('MAZE');
            blackScreen.style.opacity = 0;
            setTimeout(() => blackScreen.classList.add('hidden'), 1000);
        };
    }
}

function killPlayer() {
    player.isDead = true;
    monster.attacking = true;
    monster.element.style.backgroundImage = `url('${assets.monster.attack}')`;
    sounds.ataqueMonster.play();
    sounds.playerDead.play();
    
    setTimeout(() => {
        monster.attacking = false; // Volta a andar (lógica visual)
        triggerGameOver('killed');
    }, 1500); // Tempo da animação de morte
}

function triggerGameOver(reason) {
    gameState = 'GAMEOVER';
    if(reason === 'falling') sounds.grito.play();
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function finishGame() {
    gameState = 'ENDING';
    blackScreen.classList.remove('hidden');
    blackScreen.style.opacity = 1;
    
    const endText = "Nunca-mais-quis-voltar-naquela-escola...\nPensei-em-contar-para-meus-colegas-o-que-vi-lá...\nMas-quem-acreditaria...?\nPra-ser-sincera...\nNem-eu-sei-o-que-vi-lá...\nFalei-para-minha-mãe-que-estava-com-problemas-na-escola...\nEla-me-tirou-daquele-lugar...\nMas-o-que-será-dos-outros-alunos...";
    
    setTimeout(() => {
        typeWriter(endText, introText, () => {
            setTimeout(() => {
                location.reload();
            }, 5000);
        });
    }, 1000);
}
