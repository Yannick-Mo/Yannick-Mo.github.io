(function () {
    var GAMES = [
        { id: 'snake', name: '🐍 贪吃蛇', file: 'snake.js' },
        { id: 'tetris', name: '🧱 俄罗斯方块', file: 'tetris.js' },
        { id: 'breakout', name: '🏓 打砖块', file: 'breakout.js' },
        { id: 'pong', name: '⚪ Pong', file: 'pong.js' },
        { id: 'flappy', name: '🐦 Flappy Bird', file: 'flappy.js' },
        { id: 'asteroids', name: '🚀  asteroids（小行星）', file: 'asteroids.js' },
    ];

    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/Yannick-Mo/live2d-models@v1.0.1/games/';
    var menuOverlay = null;

    var gamepadIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M192 64C86 64 0 150 0 256S86 448 192 448l256 0c106 0 192-86 192-192s-86-192-192-192L192 64zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 80 0 40 40 0 1 1 -80 0zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24l0 32 32 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-32 0 0 32c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-32-32 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l32 0 0-32z"/></svg>';

    function createOverlay() {
        if (menuOverlay) return;
        menuOverlay = document.createElement('div');
        menuOverlay.id = 'WAIFU-GAME-MENU';
        Object.assign(menuOverlay.style, {
            position: 'fixed',
            top: '0', left: '0', right: '0', bottom: '0',
            zIndex: '20000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            fontFamily: 'Arial, sans-serif',
        });

        var panel = document.createElement('div');
        Object.assign(panel.style, {
            background: '#1a1a2e',
            borderRadius: '16px',
            padding: '24px',
            minWidth: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        });

        var title = document.createElement('div');
        title.textContent = '选择游戏';
        Object.assign(title.style, {
            color: '#fff',
            fontSize: '22px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #333',
        });
        panel.appendChild(title);

        GAMES.forEach(function (g) {
            var btn = document.createElement('div');
            btn.textContent = g.name;
            Object.assign(btn.style, {
                color: '#ccc',
                fontSize: '16px',
                padding: '10px 16px',
                marginBottom: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background 0.2s',
            });
            btn.onmouseenter = function () { btn.style.background = '#16213e'; };
            btn.onmouseleave = function () { btn.style.background = 'transparent'; };
            btn.onclick = function () {
                hideMenu();
                loadGame(g);
            };
            panel.appendChild(btn);
        });

        var escHint = document.createElement('div');
        escHint.textContent = '按 Esc 关闭';
        Object.assign(escHint.style, {
            color: '#666',
            fontSize: '12px',
            textAlign: 'center',
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid #333',
        });
        panel.appendChild(escHint);

        menuOverlay.appendChild(panel);
        document.body.appendChild(menuOverlay);

        document.addEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            hideMenu();
        }
    }

    function hideMenu() {
        if (!menuOverlay) return;
        document.removeEventListener('keydown', onKeyDown);
        if (menuOverlay.parentNode) menuOverlay.parentNode.removeChild(menuOverlay);
        menuOverlay = null;
    }

    function loadGame(game) {
        var script = document.createElement('script');
        script.src = CDN_BASE + game.file;
        document.head.appendChild(script);
    }

    function initGameButton() {
        var oldSpan = document.getElementById('waifu-tool-asteroids');
        if (!oldSpan) { setTimeout(initGameButton, 300); return; }
        var newSpan = document.createElement('span');
        newSpan.id = 'waifu-tool-games';
        newSpan.innerHTML = gamepadIcon;
        newSpan.title = '选择游戏';
        newSpan.onclick = createOverlay;
        oldSpan.parentNode.replaceChild(newSpan, oldSpan);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGameButton);
    } else {
        initGameButton();
    }
    document.addEventListener('turbo:load', initGameButton);
})();
