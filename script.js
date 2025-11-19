(() => {
    'use strict';

    const doc = document;
    const body = doc.body;

    while (body.firstChild) {
        body.removeChild(body.firstChild);
    }

    Object.assign(body.style, {
        margin: '0',
        background: '#01030a',
        color: '#f8f8ff',
        fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        overflow: 'hidden',
        userSelect: 'none',
    });

    try {
        console.log(
            '%cFriendly reminder: Peeking under the hood may spoil the fun. Edit responsibly.',
            'font-size: 16px; color: #8ab4ff; font-weight: 600;'
        );
    } catch (err) {
        /* ignore console limitations */
    }

    const root = doc.createElement('div');
    Object.assign(root.style, {
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
        overflow: 'hidden',
    });
    body.appendChild(root);

    const canvas = doc.createElement('canvas');
    Object.assign(canvas.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
        cursor: 'crosshair',
    });
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const randomRange = (min, max) => Math.random() * (max - min) + min;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const storage = {
        get(key) {
            try {
                return window.localStorage.getItem(key);
            } catch (err) {
                return null;
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(key, value);
            } catch (err) {
                /* noop */
            }
        },
    };

    const persistenceKeys = {
        best: 'launcher_best',
        lifetime: 'launcher_lifetime',
    };

    const preferenceKeys = {
        music: 'launcher_music_enabled',
        sfx: 'launcher_sfx_enabled',
        musicVolume: 'launcher_music_volume',
        sfxVolume: 'launcher_sfx_volume',
    };

    const assistPreferenceKeys = {
        trajectory: 'launcher_assist_trajectory',
        superEasy: 'launcher_super_easy_mode',
        streakShield: 'launcher_streak_shield',
        cheatsUnlocked: 'launcher_cheats_unlocked',
    };

    const TRAINING_WHEEL_CAP = 5;
    const CHEAT_CODE = 'orbit';

    const readBooleanPref = (key, fallback = false) => {
        const stored = storage.get(key);
        if (stored === null) {
            return fallback;
        }
        return stored !== '0';
    };

    const readVolumePref = (key, fallback) => {
        const stored = storage.get(key);
        const parsed = Number(stored);
        if (Number.isFinite(parsed)) {
            return clamp(parsed, 0, 1);
        }
        return fallback;
    };

    const storedBest = Number(storage.get(persistenceKeys.best)) || 0;
    const storedLifetime = Number(storage.get(persistenceKeys.lifetime)) || 0;
    const defaultTrajectory = readBooleanPref(assistPreferenceKeys.trajectory, storedBest < TRAINING_WHEEL_CAP);

    const calmingTrackFiles = [
        '01 Kevin MacLeod - Carefree.mp3',
        '02 Kevin MacLeod - Meditation Impromptu 01.mp3',
        '03 Kevin MacLeod - Meditation Impromptu 02.mp3',
        '04 Kevin MacLeod - Meditation Impromptu 03.mp3',
        '05 Kevin MacLeod - Winter Reflections.mp3',
        '06 Kevin MacLeod - On the Passing of Time.mp3',
        '07 Kevin MacLeod - Dream Culture.mp3',
        '08 Kevin MacLeod - Windswept.mp3',
        '09 Kevin MacLeod - Inner Light.mp3',
        '10 Kevin MacLeod - Enchanted Journey.mp3',
        '11 Kevin MacLeod - Silver Blue Light.mp3',
        '12 Kevin MacLeod - Autumn Day.mp3',
        '13 Kevin MacLeod - Smoother Move.mp3',
        '14 Kevin MacLeod - Sovereign Quarter.mp3',
        '15 Kevin MacLeod - Calmant.mp3',
        '16 Kevin MacLeod - Impromptu in Quarter Comma Meantone.mp3',
        '17 Kevin MacLeod - Danse Morialta.mp3',
        '18 Kevin MacLeod - Clean Soul.mp3',
        '19 Kevin MacLeod - Resignation.mp3',
        '20 Kevin MacLeod - Reaching Out.mp3',
    ];

    const buildPlaylist = () =>
        calmingTrackFiles.map((file) => {
            const withoutIndex = file.replace(/^\d+\s+/, '');
            const [artistRaw, titleRaw = ''] = withoutIndex.split(' - ');
            const title = titleRaw.replace(/\.mp3$/i, '').trim();
            const artist = (artistRaw || 'Unknown').trim();
            return {
                src: encodeURI(`music/Calming/${file}`),
                title,
                artist,
            };
        });

    const playlist = buildPlaylist();

    const state = {
        width: window.innerWidth,
        height: window.innerHeight,
        groundY: 0,
        launchOrigin: { x: 0, y: 0 },
        gravity: 0.55,
        airDrag: 0.994,
        uiScale: 1,
        REST: 0.45,
        SIDE_REST: 0.50,
        MIN_BOUNCE: 0.15,

        score: 0,
        best: storedBest,
        lifetime: storedLifetime,
        paused: false,
        lastTime: performance.now(),
        statusTimer: 0,
        bucket: {
            x: 0,
            y: 0,
            width: 120,
            depth: 100,
            wall: 14,
            color: '#38f',
            rim: '#fff8',
        },
        ball: {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 18,
            ready: true,
            launched: false,
            trail: [],
        },
        pointer: {
            active: false,
            pointerId: null,
            currentX: 0,
            currentY: 0,
            tension: 0,
        },
        background: {
            top: '#04162b',
            bottom: '#092340',
            ridges: [],
            stars: [],
        },
        sparkles: [],
        floatingTexts: [],
        audio: {
            ctx: null,
            musicEnabled: storage.get(preferenceKeys.music) !== '0',
            sfxEnabled: storage.get(preferenceKeys.sfx) !== '0',
            musicVolume: readVolumePref(preferenceKeys.musicVolume, 0.55),
            sfxVolume: readVolumePref(preferenceKeys.sfxVolume, 0.85),
            playlist,
            audioElement: null,
            currentTrackIndex: -1,
            nowPlayingTimer: 0,
            noiseBuffer: null,
        },
        assists: {
            showTrajectory: defaultTrajectory,
            superEasyMode: readBooleanPref(assistPreferenceKeys.superEasy, false),
            streakShield: readBooleanPref(assistPreferenceKeys.streakShield, false),
            cheatsUnlocked: readBooleanPref(assistPreferenceKeys.cheatsUnlocked, false),
        },
    };

    const createMenuButton = (parent, label) => {
        const button = doc.createElement('button');
        button.textContent = label;
        Object.assign(button.style, {
            padding: '0.95rem 1.2rem',
            borderRadius: '0.85rem',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#fff',
            fontSize: '0.95rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'background 0.2s ease, transform 0.1s ease',
        });
        button.addEventListener('pointerdown', () => {
            button.style.transform = 'scale(0.97)';
        });
        const resetTransform = () => {
            button.style.transform = 'scale(1)';
        };
        button.addEventListener('pointerup', resetTransform);
        button.addEventListener('pointerleave', resetTransform);
        parent.appendChild(button);
        return button;
    };

    const createSectionTitle = (text) => {
        const title = doc.createElement('h3');
        title.textContent = text;
        Object.assign(title.style, {
            margin: '0',
            fontSize: '1rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)',
        });
        return title;
    };

    const createSliderRow = (label, initialValue, onInput) => {
        const wrapper = doc.createElement('label');
        Object.assign(wrapper.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            color: '#fff',
            fontSize: '0.9rem',
        });

        const topRow = doc.createElement('div');
        topRow.textContent = `${label} (${Math.round(initialValue * 100)}%)`;
        Object.assign(topRow.style, {
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.75)',
        });
        wrapper.appendChild(topRow);

        const slider = doc.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.step = '1';
        slider.value = String(Math.round(initialValue * 100));
        Object.assign(slider.style, {
            width: '100%',
            accentColor: '#60a5fa',
        });
        slider.addEventListener('input', () => {
            const value = slider.valueAsNumber / 100;
            topRow.textContent = `${label} (${Math.round(value * 100)}%)`;
            onInput(value);
        });
        wrapper.appendChild(slider);
        return wrapper;
    };

    const hud = doc.createElement('div');
    Object.assign(hud.style, {
        position: 'absolute',
        top: '1.25rem',
        left: '1.5rem',
        display: 'flex',
        gap: '1rem',
        padding: '0.85rem 1.15rem',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(6px)',
        alignItems: 'center',
        pointerEvents: 'none',
        transformOrigin: 'top left',
    });
    root.appendChild(hud);

    const createStat = (label) => {
        const wrapper = doc.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.fontSize = '0.8rem';
        wrapper.style.textTransform = 'uppercase';
        wrapper.style.letterSpacing = '0.08em';
        wrapper.style.color = 'rgba(255,255,255,0.7)';

        const value = doc.createElement('span');
        value.textContent = '0';
        value.style.fontSize = '1.2rem';
        value.style.fontWeight = '600';
        value.style.letterSpacing = 'normal';
        value.style.color = '#ffffff';

        wrapper.appendChild(doc.createTextNode(label));
        wrapper.appendChild(value);
        hud.appendChild(wrapper);
        return value;
    };

    const streakValue = createStat('Streak');
    const bestValue = createStat('Best');
    const lifetimeValue = createStat('Lifetime');

    const instructions = doc.createElement('div');
    Object.assign(instructions.style, {
        position: 'absolute',
        bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translate(-50%, 0)',
        transformOrigin: 'bottom center',
        padding: '0.7rem 1.2rem',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.4)',
        color: 'rgba(255,255,255,0.8)',
        fontSize: '0.9rem',
        letterSpacing: '0.03em',
        textAlign: 'center',
        pointerEvents: 'none',
        backdropFilter: 'blur(6px)',
    });
    instructions.textContent = 'Press, pull, and release the orb like an elastic. Press R to reset or Pause for settings + training wheels.';
    root.appendChild(instructions);

    const statusBadge = doc.createElement('div');
    Object.assign(statusBadge.style, {
        position: 'absolute',
        top: '1.2rem',
        right: '1.5rem',
        padding: '0.6rem 1rem',
        borderRadius: '0.85rem',
        background: 'rgba(0, 0, 0, 0.55)',
        color: '#fff',
        fontWeight: '600',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        minWidth: '120px',
        textAlign: 'center',
        backdropFilter: 'blur(6px)',
        transformOrigin: 'top right',
    });
    statusBadge.textContent = 'Ready';
    root.appendChild(statusBadge);

    const pauseButton = doc.createElement('button');
    Object.assign(pauseButton.style, {
        position: 'absolute',
        top: '4.2rem',
        right: '1.5rem',
        padding: '0.55rem 1.4rem',
        borderRadius: '999px',
        border: 'none',
        background: 'rgba(15, 24, 64, 0.8)',
        color: '#fff',
        fontWeight: '600',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'background 0.2s ease, transform 0.1s ease',
        transformOrigin: 'top right',
    });
    pauseButton.textContent = 'Pause';
    pauseButton.addEventListener('pointerenter', () => {
        pauseButton.style.background = 'rgba(33, 80, 180, 0.85)';
    });
    pauseButton.addEventListener('pointerleave', () => {
        pauseButton.style.background = 'rgba(15, 24, 64, 0.8)';
    });
    root.appendChild(pauseButton);

    const nowPlayingBadge = doc.createElement('div');
    Object.assign(nowPlayingBadge.style, {
        position: 'absolute',
        bottom: 'calc(4.2rem + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.5rem 1rem',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.5)',
        color: '#fff',
        fontSize: '0.85rem',
        letterSpacing: '0.03em',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.3s ease',
        transformOrigin: 'bottom center',
    });
    nowPlayingBadge.textContent = '';
    root.appendChild(nowPlayingBadge);

    const settingsOverlay = doc.createElement('div');
    Object.assign(settingsOverlay.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        opacity: '0',
        pointerEvents: 'none',
        transition: 'opacity 0.2s ease',
    });
    const settingsPanel = doc.createElement('div');
    Object.assign(settingsPanel.style, {
        width: 'min(560px, 92vw)',
        maxHeight: '90vh',
        overflow: 'hidden',
        background: 'rgba(5, 9, 20, 0.92)',
        borderRadius: '1.2rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.08)'
    });
    settingsOverlay.appendChild(settingsPanel);
    root.appendChild(settingsOverlay);

    let deferredInstallPrompt = null;
    const isStandalone = Boolean(
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone
    );

    const viewContainer = doc.createElement('div');
    Object.assign(viewContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        overflowY: 'auto',
        paddingRight: '0.2rem',
    });
    settingsPanel.appendChild(viewContainer);

    const pauseMainView = doc.createElement('div');
    Object.assign(pauseMainView.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    });
    viewContainer.appendChild(pauseMainView);

    const settingsView = doc.createElement('div');
    Object.assign(settingsView.style, {
        display: 'none',
        flexDirection: 'column',
        gap: '1rem',
    });
    viewContainer.appendChild(settingsView);

    const pauseTitle = doc.createElement('h2');
    pauseTitle.textContent = 'Paused';
    Object.assign(pauseTitle.style, {
        margin: '0',
        fontSize: '1.5rem',
        letterSpacing: '0.04em',
        color: '#fff',
        textTransform: 'uppercase',
    });
    pauseMainView.appendChild(pauseTitle);

    const pauseHint = doc.createElement('p');
    pauseHint.textContent = 'Take a breather, tweak audio, or jump back in.';
    Object.assign(pauseHint.style, {
        margin: '0',
        color: 'rgba(255,255,255,0.74)',
        fontSize: '0.95rem',
    });
    pauseMainView.appendChild(pauseHint);

    const pauseButtonColumn = doc.createElement('div');
    Object.assign(pauseButtonColumn.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    });
    pauseMainView.appendChild(pauseButtonColumn);

    const settingsTitle = doc.createElement('h2');
    settingsTitle.textContent = 'Settings';
    Object.assign(settingsTitle.style, {
        margin: '0',
        fontSize: '1.4rem',
        color: '#fff',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
    });
    settingsView.appendChild(settingsTitle);

    const settingsHint = doc.createElement('p');
    settingsHint.textContent = 'Fine tune audio, credits, and data.';
    Object.assign(settingsHint.style, {
        margin: '0',
        color: 'rgba(255,255,255,0.72)',
        fontSize: '0.92rem',
    });
    settingsView.appendChild(settingsHint);

    const settingsContent = doc.createElement('div');
    Object.assign(settingsContent.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    });
    settingsView.appendChild(settingsContent);

    const audioSection = doc.createElement('div');
    Object.assign(audioSection.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: '0.85rem',
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255,255,255,0.08)'
    });
    settingsContent.appendChild(audioSection);

    const dataSection = doc.createElement('div');
    Object.assign(dataSection.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: '0.85rem',
        background: 'rgba(32, 19, 35, 0.65)',
        border: '1px solid rgba(255,255,255,0.05)'
    });
    settingsContent.appendChild(dataSection);

    const assistsSection = doc.createElement('div');
    Object.assign(assistsSection.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        padding: '1rem',
        borderRadius: '0.85rem',
        background: 'rgba(24, 35, 66, 0.72)',
        border: '1px solid rgba(96,165,250,0.2)'
    });
    settingsContent.appendChild(assistsSection);

    const homeScreenSection = doc.createElement('div');
    Object.assign(homeScreenSection.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        borderRadius: '0.85rem',
        background: 'rgba(9, 27, 37, 0.65)',
        border: '1px solid rgba(56,189,248,0.2)'
    });
    settingsContent.appendChild(homeScreenSection);

    const creditsSection = doc.createElement('div');
    Object.assign(creditsSection.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        borderRadius: '0.85rem',
        background: 'rgba(16, 16, 32, 0.8)',
        border: '1px solid rgba(255,255,255,0.08)',
        maxHeight: '240px',
        overflowY: 'auto',
    });
    settingsContent.appendChild(creditsSection);

    const settingsFooter = doc.createElement('div');
    Object.assign(settingsFooter.style, {
        display: 'flex',
        justifyContent: 'flex-end',
    });
    settingsContent.appendChild(settingsFooter);

    let currentOverlayView = 'menu';
    const showOverlayView = (view) => {
        currentOverlayView = view;
        pauseMainView.style.display = view === 'menu' ? 'flex' : 'none';
        settingsView.style.display = view === 'settings' ? 'flex' : 'none';
    };
    showOverlayView('menu');

    audioSection.appendChild(createSectionTitle('Audio Levels'));
    const audioBlurb = doc.createElement('p');
    audioBlurb.textContent = 'Dial in background vibes and collision shimmer.';
    Object.assign(audioBlurb.style, {
        margin: '0',
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.7)',
    });
    audioSection.appendChild(audioBlurb);

    const musicVolumeSlider = createSliderRow('Music Volume', state.audio.musicVolume, (value) => {
        setMusicVolume(value);
    });
    audioSection.appendChild(musicVolumeSlider);

    const sfxVolumeSlider = createSliderRow('SFX Volume', state.audio.sfxVolume, (value) => {
        setSfxVolume(value);
    });
    audioSection.appendChild(sfxVolumeSlider);

    dataSection.appendChild(createSectionTitle('Progress & Data'));
    const dataBlurb = doc.createElement('p');
    dataBlurb.textContent = 'Need a clean slate? Resetting wipes streak, best, and lifetime attempts.';
    Object.assign(dataBlurb.style, {
        margin: '0',
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.7)',
    });
    dataSection.appendChild(dataBlurb);

    const resetStatsButton = createMenuButton(dataSection, 'Reset Stats');
    resetStatsButton.style.background = 'rgba(190, 50, 80, 0.9)';
    resetStatsButton.style.borderColor = 'rgba(248, 113, 113, 0.9)';

    let resetConfirmationTimer = null;
    let awaitingResetConfirm = false;
    const resetButtonDefaultText = 'Reset Stats';
    const resetButtonConfirmText = 'Tap again to confirm';

    const resetAllStats = () => {
        state.best = 0;
        state.lifetime = 0;
        state.score = 0;
        storage.set(persistenceKeys.best, '0');
        storage.set(persistenceKeys.lifetime, '0');
        updateScoreboard();
        setStatus('Stats reset', 1600);
        repositionBall();
    };

    resetStatsButton.addEventListener('click', () => {
        if (!awaitingResetConfirm) {
            awaitingResetConfirm = true;
            resetStatsButton.textContent = resetButtonConfirmText;
            clearTimeout(resetConfirmationTimer);
            resetConfirmationTimer = window.setTimeout(() => {
                awaitingResetConfirm = false;
                resetStatsButton.textContent = resetButtonDefaultText;
            }, 3200);
            return;
        }
        awaitingResetConfirm = false;
        resetStatsButton.textContent = resetButtonDefaultText;
        clearTimeout(resetConfirmationTimer);
        resetAllStats();
    });

    assistsSection.appendChild(createSectionTitle('Training Wheels & Cheats'));
    const assistsBlurb = doc.createElement('p');
    assistsBlurb.textContent = 'Optional helpers for practicing or chill modes. They unlock for new runs or with a cheat code.';
    Object.assign(assistsBlurb.style, {
        margin: '0',
        fontSize: '0.85rem',
        color: 'rgba(191, 219, 254, 0.85)',
    });
    assistsSection.appendChild(assistsBlurb);

    const assistsStatus = doc.createElement('p');
    Object.assign(assistsStatus.style, {
        margin: '0',
        fontSize: '0.82rem',
        color: 'rgba(148, 187, 255, 0.9)',
    });
    assistsSection.appendChild(assistsStatus);

    const assistButtonGrid = doc.createElement('div');
    Object.assign(assistButtonGrid.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '0.65rem',
    });
    assistsSection.appendChild(assistButtonGrid);

    const trajectoryToggleButton = createMenuButton(assistButtonGrid, '');
    const superEasyToggleButton = createMenuButton(assistButtonGrid, '');
    const streakShieldToggleButton = createMenuButton(assistButtonGrid, '');

    const cheatRow = doc.createElement('div');
    Object.assign(cheatRow.style, {
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        flexWrap: 'wrap',
    });
    assistsSection.appendChild(cheatRow);

    const cheatInput = doc.createElement('input');
    cheatInput.type = 'text';
    Object.assign(cheatInput.style, {
        flex: '1',
        minWidth: '160px',
        padding: '0.65rem 0.8rem',
        borderRadius: '0.65rem',
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'rgba(15, 23, 42, 0.85)',
        color: '#fff',
        fontSize: '0.9rem',
    });
    cheatInput.placeholder = 'Enter cheat code (hint: orbit)';
    cheatRow.appendChild(cheatInput);

    const cheatButton = createMenuButton(cheatRow, 'Apply Code');
    cheatButton.style.padding = '0.65rem 0.9rem';

    homeScreenSection.appendChild(createSectionTitle('Add to Home Screen'));
    const homeDescription = doc.createElement('p');
    homeDescription.textContent = 'Install the launcher like a native app for full-screen play and quick access.';
    Object.assign(homeDescription.style, {
        margin: '0',
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.75)',
    });
    homeScreenSection.appendChild(homeDescription);

    const homeList = doc.createElement('ul');
    Object.assign(homeList.style, {
        margin: '0 0 0 1rem',
        padding: '0',
        color: 'rgba(255,255,255,0.8)',
        fontSize: '0.85rem',
        lineHeight: '1.4',
    });
    const steps = [
        'iOS Safari or Chrome: Share → Add to Home Screen',
        'Android Chrome: ⋮ menu → Add to Home screen',
        'Desktop Chrome/Edge: Install app icon in the address bar',
    ];
    steps.forEach((text) => {
        const li = doc.createElement('li');
        li.textContent = text;
        homeList.appendChild(li);
    });
    homeScreenSection.appendChild(homeList);

    const homeStatus = doc.createElement('p');
    Object.assign(homeStatus.style, {
        margin: '0',
        fontSize: '0.8rem',
        color: 'rgba(148, 187, 233, 0.9)',
    });
    homeScreenSection.appendChild(homeStatus);

    const updateHomeStatus = (text) => {
        homeStatus.textContent = text;
    };
    updateHomeStatus(isStandalone ? 'Already running in standalone mode.' : 'Tap the button or follow the steps above.');

    creditsSection.appendChild(createSectionTitle('Credits'));
    const developerLine = doc.createElement('p');
    developerLine.textContent = 'Developer: Don Reagan';
    developerLine.style.margin = '0';
    creditsSection.appendChild(developerLine);

    const testers = ['Tunaz_420', 'Gaymer', 'ɮǟʀɮաɨʀɛ', 'Nishi Billi'];
    const testList = doc.createElement('ul');
    Object.assign(testList.style, {
        margin: '0.2rem 0 0.4rem 1rem',
        padding: '0',
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.85rem',
    });
    testers.forEach((tester) => {
        const li = doc.createElement('li');
        li.textContent = `Testing: ${tester}`;
        testList.appendChild(li);
    });
    creditsSection.appendChild(testList);

    const musicLine = doc.createElement('p');
    musicLine.textContent = 'Music: Kevin MacLeod (incompetech.com)';
    musicLine.style.margin = '0';
    creditsSection.appendChild(musicLine);

    const trackList = doc.createElement('ul');
    Object.assign(trackList.style, {
        margin: '0.4rem 0 0.4rem 1rem',
        padding: '0',
        columns: 2,
        columnGap: '1.2rem',
        fontSize: '0.82rem',
        color: 'rgba(255,255,255,0.8)',
    });
    playlist.forEach((track) => {
        const li = doc.createElement('li');
        li.textContent = track.title;
        trackList.appendChild(li);
    });
    creditsSection.appendChild(trackList);

    const licenseLine = doc.createElement('p');
    licenseLine.style.margin = '0';
    licenseLine.style.fontSize = '0.8rem';
    licenseLine.style.color = 'rgba(255,255,255,0.7)';
    licenseLine.textContent = 'Licensed under ';
    const licenseLink = doc.createElement('a');
    licenseLink.href = 'https://creativecommons.org/licenses/by/3.0/';
    licenseLink.textContent = 'Creative Commons Attribution 3.0 (CC BY)';
    licenseLink.target = '_blank';
    licenseLink.rel = 'noreferrer noopener';
    licenseLink.style.color = '#a5b4fc';
    licenseLine.appendChild(licenseLink);
    licenseLine.appendChild(doc.createTextNode('.'));
    creditsSection.appendChild(licenseLine);



    const updateScoreboard = () => {
        streakValue.textContent = state.score.toString();
        bestValue.textContent = state.best.toString();
        lifetimeValue.textContent = state.lifetime.toString();
    };

    updateScoreboard();

    const updateResponsiveScale = () => {
        const scale = clamp(Math.min(state.width / 1280, state.height / 780), 0.6, 1);
        state.uiScale = scale;
        hud.style.transform = `scale(${scale})`;
        statusBadge.style.transform = `scale(${scale})`;
        pauseButton.style.transform = `scale(${scale})`;
        instructions.style.transform = `translate(-50%, 0) scale(${scale})`;
        nowPlayingBadge.style.transform = `translate(-60%, 0) scale(${scale})`;
    };

    const setStatus = (text, duration = 2000) => {
        statusBadge.textContent = text;
        state.statusTimer = duration;
    };

    function ensureAudioContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            return null;
        }
        if (!state.audio.ctx) {
            try {
                state.audio.ctx = new AudioCtx();
            } catch (err) {
                return null;
            }
        }
        if (state.audio.ctx.state === 'suspended') {
            state.audio.ctx.resume();
        }
        return state.audio.ctx;
    }

    function ensureNoiseBuffer(ctx) {
        if (!ctx) {
            return null;
        }
        if (!state.audio.noiseBuffer) {
            const duration = 0.3;
            const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                const t = i / data.length;
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3);
            }
            state.audio.noiseBuffer = buffer;
        }
        return state.audio.noiseBuffer;
    }

    function playSuccessSound() {
        const ctx = ensureAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // Utility to make a short pluck-like beep
        const beep = (freq, start) => {
            const osc = ctx.createOscillator();
            osc.type = "sine";

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.20);

            osc.frequency.setValueAtTime(freq, start);
            osc.connect(gain).connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.25);
        };

        // Three ascending tones
        beep(600, now + 0.00);
        beep(850, now + 0.12);
        beep(1100, now + 0.24);
    }

    // ------------------------------------
    // High-order glass ping generator
    // ------------------------------------
    function createGlassPing(ctx, freq, time, strength = 1) {
        // Clamp requested freq to Web Audio limits
        const minF = 20;
        const maxF = 24000;
        const f0 = Math.max(minF, Math.min(maxF, freq));
        const f1 = Math.max(minF, Math.min(maxF, freq * 1.08));

        const gain = ctx.createGain();
        const osc = ctx.createOscillator();
        osc.type = "sine";

        osc.frequency.setValueAtTime(f0, time);
        osc.frequency.linearRampToValueAtTime(f1, time + 0.008);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.18 * strength, time + 0.0015);
        gain.gain.exponentialRampToValueAtTime(0.012 * strength, time + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);

        osc.connect(gain).connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
    }


    function createGlassCrack(ctx, time, strength = 1) {
        const src = ctx.createBufferSource();
        src.buffer = ensureNoiseBuffer(ctx);

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 6000;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.15 * strength, time + 0.0005);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.003);

        src.connect(hp).connect(g).connect(ctx.destination);
        src.start(time);
        src.stop(time + 0.0035);
    }



    // ------------------------------------
    // Main collision sound
    // ------------------------------------
    function playCollisionSound(intensity = 0.5) {
        if (!state.audio.sfxEnabled) return;

        const ctx = ensureAudioContext();
        if (!ctx) return;

        const dynamicIntensity = clamp(intensity, 0.12, 1.2);
        const amplitude = dynamicIntensity * state.audio.sfxVolume;
        if (amplitude <= 0.01) return;

        const now = ctx.currentTime;

        // Base bandpass noise (unchanged)
        const src = ctx.createBufferSource();
        src.buffer = ensureNoiseBuffer(ctx);

        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 380 + dynamicIntensity * 70;
        band.Q.value = 9;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.18 * amplitude, now + 0.003);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

        src.connect(band).connect(noiseGain).connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.14);

        // --- Add crack transient ---
        createGlassCrack(ctx, now, amplitude * 1.3);

        // --- Modal cluster (real glass partials) ---
        const base = 7200 + dynamicIntensity * 180;

        const MODES = [1.00, 1.37, 2.10, 2.92, 4.15];

        for (let i = 0; i < MODES.length; i++) {
            const t = now + i * 0.006;       // tiny staggering
            const s = amplitude * (0.9 - i * 0.13); // decreasing strengths
            createGlassPing(ctx, base * MODES[i], t, s);
        }
    }

    function playLaunchSound(launchSpeed = 1) {
        if (!state.audio.sfxEnabled) return;

        const ctx = ensureAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // Normalize + clamp speed → (0.1 to 1.3)
        const speed = clamp(launchSpeed / 1400, 0.1, 1.3);
        const amplitude = speed * state.audio.sfxVolume;

        if (amplitude < 0.01) return;

        // ------------------------------------
        // 1. Soft crack (lighter than collision)
        // ------------------------------------
        {
            const src = ctx.createBufferSource();
            src.buffer = ensureNoiseBuffer(ctx);

            const hp = ctx.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.value = 4500 + speed * 2000;

            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.08 * amplitude, now + 0.0004);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.0023);

            src.connect(hp).connect(g).connect(ctx.destination);
            src.start(now);
            src.stop(now + 0.0025);
        }

        // ------------------------------------
        // 2. Playful 2-step chirp (launch personality)
        // ------------------------------------
        const chirp = (freq, t) => {
            const osc = ctx.createOscillator();
            osc.type = "sine";

            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.22 * amplitude, t + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

            // subtle bend upward
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.linearRampToValueAtTime(freq * 1.05, t + 0.008);

            osc.connect(g).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.1);
        };

        const baseChirp = 350 + speed * 250;
        chirp(baseChirp, now);
        chirp(baseChirp * 1.35, now + 0.05);  // ascending = playful


        // ------------------------------------
        // 3. Light modal resonance (glass but softer)
        // ------------------------------------
        const base = 5500 + speed * 1600;  // lower than impact glass

        // same modal set as your glass collisions
        const MODES = [1.00, 1.37, 2.10];

        for (let i = 0; i < MODES.length; i++) {
            const t = now + 0.012 + i * 0.004;
            const strength = amplitude * (0.4 - i * 0.1); // soft & playful

            createGlassPing(ctx, base * MODES[i], t, strength);
        }
    }


    function showNowPlaying(track) {
        if (!track) {
            return;
        }
        nowPlayingBadge.textContent = `Now Playing ${track.title} by ${track.artist}`;
        nowPlayingBadge.style.opacity = '1';
        state.audio.nowPlayingTimer = 4500;
    }

    function updateNowPlayingBadge(deltaMs) {
        if (state.audio.nowPlayingTimer > 0) {
            state.audio.nowPlayingTimer -= deltaMs;
            if (state.audio.nowPlayingTimer <= 0) {
                nowPlayingBadge.style.opacity = '0';
            }
        }
    }

    function ensureMusicElement() {
        if (!state.audio.playlist.length) {
            return null;
        }
        if (!state.audio.audioElement) {
            const audio = new Audio();
            audio.loop = false;
            audio.volume = state.audio.musicVolume;
            audio.preload = 'auto';
            audio.addEventListener('ended', () => {
                if (state.audio.musicEnabled) {
                    queueNextTrack();
                }
            });
            state.audio.audioElement = audio;
        }
        return state.audio.audioElement;
    }

    function playTrackAt(index) {
        if (!state.audio.playlist.length) {
            return;
        }
        const audio = ensureMusicElement();
        if (!audio) {
            return;
        }
        const normalized = (index + state.audio.playlist.length) % state.audio.playlist.length;
        const track = state.audio.playlist[normalized];
        state.audio.currentTrackIndex = normalized;
        audio.src = track.src;
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
                showNowPlaying(track);
            }).catch(() => {
                /* ignore play race */
            });
        } else {
            showNowPlaying(track);
        }
    }

    function queueNextTrack() {
        if (!state.audio.playlist.length) {
            return;
        }
        const nextIndex = state.audio.currentTrackIndex === -1
            ? Math.floor(Math.random() * state.audio.playlist.length)
            : (state.audio.currentTrackIndex + 1) % state.audio.playlist.length;
        playTrackAt(nextIndex);
    }

    function startMusic() {
        if (!state.audio.musicEnabled) {
            return;
        }
        ensureAudioContext();
        const audio = ensureMusicElement();
        if (!audio) {
            return;
        }
        audio.volume = state.audio.musicVolume;
        if (!audio.paused && !audio.ended) {
            return;
        }
        const index = state.audio.currentTrackIndex === -1
            ? Math.floor(Math.random() * state.audio.playlist.length)
            : state.audio.currentTrackIndex;
        playTrackAt(index);
    }

    function stopMusic() {
        const audio = state.audio.audioElement;
        if (!audio) {
            return;
        }
        audio.pause();
        try {
            audio.currentTime = 0;
        } catch (err) {
            /* ignore */
        }
    }

    function setMusicEnabled(enabled) {
        state.audio.musicEnabled = enabled;
        storage.set(preferenceKeys.music, enabled ? '1' : '0');
        if (enabled) {
            if (state.audio.audioElement) {
                state.audio.audioElement.volume = state.audio.musicVolume;
            }
            startMusic();
        } else {
            state.audio.nowPlayingTimer = 0;
            nowPlayingBadge.style.opacity = '0';
            nowPlayingBadge.textContent = '';
            stopMusic();
        }
    }

    function setSfxEnabled(enabled) {
        state.audio.sfxEnabled = enabled;
        storage.set(preferenceKeys.sfx, enabled ? '1' : '0');
    }

    function setMusicVolume(value) {
        const normalized = clamp(value, 0, 1);
        state.audio.musicVolume = normalized;
        storage.set(preferenceKeys.musicVolume, String(normalized));
        if (state.audio.audioElement) {
            state.audio.audioElement.volume = normalized;
        }
    }

    function setSfxVolume(value) {
        const normalized = clamp(value, 0, 1);
        state.audio.sfxVolume = normalized;
        storage.set(preferenceKeys.sfxVolume, String(normalized));
    }

    function unlockAudio() {
        ensureAudioContext();
        if (state.audio.musicEnabled) {
            startMusic();
        }
    }

    ['pointerdown', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, unlockAudio, { passive: true });
    });
    window.addEventListener('keydown', unlockAudio);

    const styleToggleButton = (button, active) => {
        button.style.background = active ? 'rgba(37, 99, 235, 0.9)' : 'rgba(15, 23, 42, 0.85)';
        button.style.borderColor = active ? 'rgba(148, 187, 255, 0.85)' : 'rgba(255,255,255,0.12)';
    };

    const assistsUnlocked = () => state.best < TRAINING_WHEEL_CAP || state.assists.cheatsUnlocked;

    const persistAssistFlag = (key, value) => {
        storage.set(key, value ? '1' : '0');
    };

    const setTrajectoryAssist = (enabled) => {
        state.assists.showTrajectory = enabled && assistsUnlocked();
        persistAssistFlag(assistPreferenceKeys.trajectory, state.assists.showTrajectory);
    };

    const setSuperEasyMode = (enabled) => {
        state.assists.superEasyMode = enabled && assistsUnlocked();
        persistAssistFlag(assistPreferenceKeys.superEasy, state.assists.superEasyMode);
        randomizeBucket();
    };

    const setStreakShield = (enabled) => {
        state.assists.streakShield = enabled && assistsUnlocked();
        persistAssistFlag(assistPreferenceKeys.streakShield, state.assists.streakShield);
    };

    const enforceAssistLock = (silent = false) => {
        if (assistsUnlocked()) {
            return;
        }
        if (state.assists.showTrajectory || state.assists.superEasyMode || state.assists.streakShield) {
            state.assists.showTrajectory = false;
            state.assists.superEasyMode = false;
            state.assists.streakShield = false;
            persistAssistFlag(assistPreferenceKeys.trajectory, false);
            persistAssistFlag(assistPreferenceKeys.superEasy, false);
            persistAssistFlag(assistPreferenceKeys.streakShield, false);
            if (!silent) {
                setStatus('Training wheels tucked away after your streak.', 1800);
            }
            if (state.groundY > 0) {
                randomizeBucket();
            }
        }
    };

    const updateAssistButtons = () => {
        const unlocked = assistsUnlocked();
        if (state.assists.cheatsUnlocked && state.best >= TRAINING_WHEEL_CAP) {
            assistsStatus.textContent = 'Cheats unlocked — helpers stay available beyond the streak cap.';
        } else if (unlocked) {
            assistsStatus.textContent = `Available while under streak ${TRAINING_WHEEL_CAP}. Use them freely or practice till you beat it.`;
        } else {
            assistsStatus.textContent = `Locked (you cleared streak ${TRAINING_WHEEL_CAP}). Enter the cheat code to reopen them.`;
        }

        const applyAvailability = (button) => {
            button.disabled = !unlocked;
            button.style.opacity = unlocked ? '1' : '0.55';
            button.style.cursor = unlocked ? 'pointer' : 'not-allowed';
        };

        applyAvailability(trajectoryToggleButton);
        applyAvailability(superEasyToggleButton);
        applyAvailability(streakShieldToggleButton);

        trajectoryToggleButton.textContent = `Trajectory Preview: ${state.assists.showTrajectory ? 'On' : 'Off'}`;
        superEasyToggleButton.textContent = `Super Easy Mode: ${state.assists.superEasyMode ? 'On' : 'Off'}`;
        streakShieldToggleButton.textContent = `Streak Shield: ${state.assists.streakShield ? 'On' : 'Off'}`;

        styleToggleButton(trajectoryToggleButton, unlocked && state.assists.showTrajectory);
        styleToggleButton(superEasyToggleButton, unlocked && state.assists.superEasyMode);
        styleToggleButton(streakShieldToggleButton, unlocked && state.assists.streakShield);

        if (state.assists.cheatsUnlocked && state.best < TRAINING_WHEEL_CAP) {
            assistsStatus.textContent += ' Cheats unlocked.';
        }
    };

    const applyCheatCode = () => {
        if (state.assists.cheatsUnlocked) {
            setStatus('Cheats already unlocked.', 1200);
            updateAssistButtons();
            return;
        }
        const code = cheatInput.value.trim().toLowerCase();
        if (code && code === CHEAT_CODE) {
            state.assists.cheatsUnlocked = true;
            persistAssistFlag(assistPreferenceKeys.cheatsUnlocked, true);
            setStatus('Cheat code accepted. Training wheels stay open.', 2000);
            updateAssistButtons();
        } else {
            setStatus('Code not recognized.', 1400);
        }
    };

    const resumeButton = createMenuButton(pauseButtonColumn, 'Resume Play');
    resumeButton.style.background = 'rgba(16, 185, 129, 0.85)';
    resumeButton.style.borderColor = 'rgba(110, 231, 183, 0.85)';

    const musicToggleButton = createMenuButton(pauseButtonColumn, '');
    const updateMusicToggleButton = () => {
        musicToggleButton.textContent = `Music: ${state.audio.musicEnabled ? 'On' : 'Off'}`;
        styleToggleButton(musicToggleButton, state.audio.musicEnabled);
    };
    musicToggleButton.addEventListener('click', () => {
        setMusicEnabled(!state.audio.musicEnabled);
        updateMusicToggleButton();
    });

    const sfxToggleButton = createMenuButton(pauseButtonColumn, '');
    const updateSfxToggleButton = () => {
        sfxToggleButton.textContent = `Sound FX: ${state.audio.sfxEnabled ? 'On' : 'Off'}`;
        styleToggleButton(sfxToggleButton, state.audio.sfxEnabled);
    };
    sfxToggleButton.addEventListener('click', () => {
        setSfxEnabled(!state.audio.sfxEnabled);
        updateSfxToggleButton();
    });

    const settingsNavButton = createMenuButton(pauseButtonColumn, 'Settings');
    settingsNavButton.style.background = 'rgba(59, 130, 246, 0.85)';
    settingsNavButton.style.borderColor = 'rgba(191, 219, 254, 0.85)';

    const homeScreenButton = createMenuButton(pauseButtonColumn, 'Add to Home Screen');
    homeScreenButton.style.background = 'rgba(14, 116, 144, 0.85)';
    homeScreenButton.style.borderColor = 'rgba(125, 211, 252, 0.85)';

    const settingsBackButton = createMenuButton(settingsFooter, 'Back to Pause Menu');

    const ensureAssistAccess = () => {
        if (assistsUnlocked()) {
            return true;
        }
        setStatus(`Helpers lock once you beat streak ${TRAINING_WHEEL_CAP}. Enter the code to reopen them.`, 2000);
        updateAssistButtons();
        return false;
    };

    trajectoryToggleButton.addEventListener('click', () => {
        if (!ensureAssistAccess()) {
            return;
        }
        setTrajectoryAssist(!state.assists.showTrajectory);
        updateAssistButtons();
        setStatus(state.assists.showTrajectory ? 'Trajectory preview on' : 'Trajectory preview off', 1200);
    });

    superEasyToggleButton.addEventListener('click', () => {
        if (!ensureAssistAccess()) {
            return;
        }
        setSuperEasyMode(!state.assists.superEasyMode);
        updateAssistButtons();
        setStatus(state.assists.superEasyMode ? 'Super easy mode on' : 'Super easy mode off', 1200);
    });

    streakShieldToggleButton.addEventListener('click', () => {
        if (!ensureAssistAccess()) {
            return;
        }
        setStreakShield(!state.assists.streakShield);
        updateAssistButtons();
        setStatus(state.assists.streakShield ? 'Streak shield armed' : 'Streak shield disarmed', 1200);
    });

    cheatButton.addEventListener('click', () => {
        applyCheatCode();
        updateAssistButtons();
    });

    cheatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyCheatCode();
            updateAssistButtons();
        }
    });

    const openSettingsView = (focusElement = null) => {
        showOverlayView('settings');
        if (focusElement) {
            requestAnimationFrame(() => {
                try {
                    focusElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } catch (err) {
                    /* ignore */
                }
            });
        }
    };

    resumeButton.addEventListener('click', () => {
        setPaused(false);
    });
    settingsNavButton.addEventListener('click', () => {
        openSettingsView();
    });

    settingsBackButton.addEventListener('click', () => {
        showOverlayView('menu');
    });

    updateMusicToggleButton();
    updateSfxToggleButton();
    updateAssistButtons();

    const updateAddToHomeButtonLabel = () => {
        if (isStandalone) {
            homeScreenButton.textContent = 'Installed';
            homeScreenButton.disabled = true;
            homeScreenButton.style.opacity = '0.6';
            homeScreenButton.style.cursor = 'default';
            return;
        }
        homeScreenButton.disabled = false;
        homeScreenButton.style.opacity = '1';
        homeScreenButton.style.cursor = 'pointer';
        if (deferredInstallPrompt) {
            homeScreenButton.textContent = 'Install App';
        } else {
            homeScreenButton.textContent = 'Add to Home Screen';
        }
    };
    updateAddToHomeButtonLabel();

    homeScreenButton.addEventListener('click', async () => {
        if (isStandalone) {
            updateHomeStatus('Already installed and ready on your home screen.');
            return;
        }
        if (deferredInstallPrompt) {
            try {
                deferredInstallPrompt.prompt();
                const choice = await deferredInstallPrompt.userChoice;
                if (choice && choice.outcome === 'accepted') {
                    updateHomeStatus('Installation requested — check your device home screen.');
                } else {
                    updateHomeStatus('Install dismissed. You can retry any time.');
                }
            } catch (err) {
                updateHomeStatus('Install prompt could not be shown. Use the manual steps below.');
            } finally {
                deferredInstallPrompt = null;
                updateAddToHomeButtonLabel();
            }
            return;
        }
        openSettingsView(homeScreenSection);
        updateHomeStatus('Follow the steps below to pin the launcher.');
    });

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        updateAddToHomeButtonLabel();
        updateHomeStatus('Install prompt ready — tap the button to add me!');
    });

    const handleGlobalKeyDown = (event) => {
        if (event.repeat) {
            return;
        }
        const key = event.key.toLowerCase();
        if (key === 'r') {
            if (state.paused) {
                return;
            }
            event.preventDefault();
            quickFailAttempt();
        } else if (key === 'escape') {
            event.preventDefault();
            setPaused(!state.paused);
        }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    const applyPauseVisuals = (isPaused) => {
        settingsOverlay.style.opacity = isPaused ? '1' : '0';
        settingsOverlay.style.pointerEvents = isPaused ? 'auto' : 'none';
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
    };

    const setPaused = (value) => {
        const nextValue = Boolean(value);
        if (state.paused === nextValue) {
            return;
        }
        state.paused = nextValue;
        if (state.paused) {
            endPointer();
            statusBadge.textContent = 'Paused';
            state.statusTimer = 0;
            showOverlayView('menu');
            applyPauseVisuals(true);
        } else {
            state.lastTime = performance.now();
            applyPauseVisuals(false);
            setStatus('Game resumed', 900);
        }
    };

    pauseButton.addEventListener('click', () => {
        setPaused(!state.paused);
    });

    applyPauseVisuals(false);

    const rebuildBackdrop = () => {
        const hue = randomRange(180, 340);
        state.background.top = `hsl(${hue}, 70%, ${randomRange(12, 25)}%)`;
        state.background.bottom = `hsl(${(hue + randomRange(20, 60)) % 360}, 55%, ${randomRange(35, 55)}%)`;
        state.background.ridges = [];
        const layerCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < layerCount; i++) {
            const points = [];
            const segments = 6 + Math.floor(Math.random() * 5);
            for (let s = 0; s <= segments; s++) {
                const t = s / segments;
                const x = t * state.width;
                const offset = Math.sin(t * Math.PI * randomRange(0.8, 1.6)) * randomRange(20, 120);
                const baseY = state.height * (0.25 + 0.18 * i);
                points.push({ x, y: baseY + offset + randomRange(-30, 30) });
            }
            const layerHue = (hue + randomRange(-20, 20) + 360) % 360;
            const sat = clamp(50 - i * 8, 20, 60);
            const light = clamp(20 + i * 10, 15, 60);
            state.background.ridges.push({
                color: `hsla(${layerHue}, ${sat}%, ${light}%, 0.45)`,
                points,
            });
        }

        state.background.stars = [];
        const starCount = 40 + Math.floor(Math.random() * 60);
        for (let i = 0; i < starCount; i++) {
            state.background.stars.push({
                x: Math.random() * state.width,
                y: Math.random() * state.height * 0.55,
                size: randomRange(0.6, 2.2),
                alpha: randomRange(0.2, 0.8),
            });
        }
    };

    const randomizeBucket = () => {
        const assistScale = state.assists.superEasyMode ? 1.35 : 1;
        const depthScale = state.assists.superEasyMode ? 1.18 : 1;
        const wallBoost = state.assists.superEasyMode ? 1.15 : 1;

        const minWidth = Math.max(70, state.width * 0.08) * assistScale;
        const maxWidth = Math.max(minWidth + 40, state.width * 0.2) * assistScale;
        state.bucket.width = randomRange(minWidth, maxWidth);
        state.bucket.depth = randomRange(Math.max(70, state.height * 0.14), Math.max(110, state.height * 0.22)) * depthScale;
        state.bucket.wall = clamp(state.bucket.width * randomRange(0.12, 0.2) * wallBoost, 10, 32);

        const maxX = Math.max(20, state.width - state.bucket.width - 40);
        const assistMinX = state.assists.superEasyMode ? state.width * 0.32 : state.width * 0.45;
        const assistMaxX = state.assists.superEasyMode ? Math.min(maxX, state.width * 0.72) : Math.max(state.width * 0.5, maxX);
        const minX = clamp(assistMinX, 10, maxX);
        const maxRangeX = Math.max(minX + 20, assistMaxX);
        state.bucket.x = randomRange(minX, maxRangeX);
        const topMin = Math.max(40, state.height * 0.1);
        const topLimit = Math.min(state.groundY - state.bucket.depth - 40, state.height * 0.65);
        const bucketMaxY = Math.max(topMin + 20, topLimit);
        state.bucket.y = randomRange(topMin, bucketMaxY);

        const hue = randomRange(150, 260);
        const bucketLightness = state.assists.superEasyMode ? 64 : 55;
        const bucketAlpha = state.assists.superEasyMode ? 0.6 : 0.5;
        state.bucket.color = `hsla(${hue}, 78%, ${bucketLightness}%, ${bucketAlpha})`;
        state.bucket.rim = state.assists.superEasyMode
            ? `hsl(${hue}, 94%, 78%)`
            : `hsl(${hue}, 90%, 70%)`;
    };

    enforceAssistLock(true);
    updateAssistButtons();

    // --- Bucket colliders: treat walls as thick line segments ---
    function getBucketColliders() {
        const b = state.bucket;

        const left = {
            type: 'line',
            x1: b.x,
            y1: b.y,
            x2: b.x,
            y2: b.y + b.depth,
            thickness: b.wall
        };

        const right = {
            type: 'line',
            x1: b.x + b.width,
            y1: b.y,
            x2: b.x + b.width,
            y2: b.y + b.depth,
            thickness: b.wall
        };

        const bottom = {
            type: 'line',
            x1: b.x,
            y1: b.y + b.depth,
            x2: b.x + b.width,
            y2: b.y + b.depth,
            thickness: b.wall * 0.65
        };

        return { left, right, bottom };
    }

    // --- Generic ball vs "thick line" collider ---
    function collideBallLine(ball, seg, onImpact) {
        const vx = seg.x2 - seg.x1;
        const vy = seg.y2 - seg.y1;
        const wx = ball.x - seg.x1;
        const wy = ball.y - seg.y1;

        const lenSq = vx * vx + vy * vy || 1;
        const t = clamp((wx * vx + wy * vy) / lenSq, 0, 1);

        const px = seg.x1 + vx * t;
        const py = seg.y1 + vy * t;

        const dx = ball.x - px;
        const dy = ball.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

        const minDist = ball.radius + seg.thickness * 0.5;

        if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // push ball out of the wall
            ball.x += nx * overlap;
            ball.y += ny * overlap;

            // reflect velocity (realistic-ish bounce)
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx -= 1.6 * dot * nx;
                ball.vy -= 1.6 * dot * ny;
                ball.vx *= 0.85;
                ball.vy *= 0.85;
                if (onImpact) {
                    onImpact(Math.abs(dot));
                }
            }
            return true;
        }
        return false;
    }

    const repositionBall = () => {
        state.ball.radius = clamp(state.width * 0.018, 14, 22);
        state.launchOrigin.y = state.groundY - state.ball.radius * 0.5;
        state.ball.x = state.launchOrigin.x + randomRange(-3, 3);
        state.ball.y = state.launchOrigin.y + randomRange(-3, 3);
        state.ball.vx = 0;
        state.ball.vy = 0;
        state.ball.ready = true;
        state.ball.launched = false;
        state.ball.trail = [];
        state.pointer.currentX = state.ball.x;
        state.pointer.currentY = state.ball.y;
        state.pointer.tension = 0;
    };

    const resizeCanvas = () => {
        state.width = window.innerWidth;
        state.height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(state.width * dpr);
        canvas.height = Math.floor(state.height * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        state.groundY = state.height - Math.max(100, state.height * 0.15);
        state.launchOrigin.x = state.width * 0.18;
        state.launchOrigin.y = state.groundY - state.ball.radius * 0.5;

        updateResponsiveScale();

        if (!state.ball.launched) {
            repositionBall();
        }
        rebuildBackdrop();
        randomizeBucket();
    };

    window.addEventListener('resize', () => {
        resizeCanvas();
        setStatus('Resized Arena', 1200);
    });

    resizeCanvas();

    const pointerToCanvas = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * state.width;
        const y = ((event.clientY - rect.top) / rect.height) * state.height;
        return { x, y };
    };

    const getMaxDragDistance = () => state.height - state.groundY - state.ball.radius;

    const computeLaunchVelocity = () => {
        const anchorX = state.launchOrigin.x;
        const anchorY = state.launchOrigin.y;
        const dx = anchorX - state.ball.x;
        const dy = anchorY - state.ball.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 6) {
            return null;
        }

        const maxDrag = getMaxDragDistance();
        const strength = clamp(distance / maxDrag, 0, 1);
        const maxSpeed = Math.max(state.width, state.height) * 0.04 + 4;
        const speed = strength * maxSpeed;

        const inv = 1 / distance;
        return {
            vx: dx * inv * speed,
            vy: dy * inv * speed,
            speed
        };
    };

    const updateDraggedBallPosition = (x, y) => {
        const anchorX = state.launchOrigin.x;
        const anchorY = state.launchOrigin.y;
        const dx = x - anchorX;
        const dy = y - anchorY;
        const distance = Math.hypot(dx, dy);
        const maxDrag = getMaxDragDistance();
        let effectiveX = anchorX;
        let effectiveY = anchorY;
        let tension = 0;
        if (distance > 0) {
            const clamped = Math.min(distance, maxDrag);
            const ratio = clamped / distance;
            effectiveX = anchorX + dx * ratio;
            effectiveY = anchorY + dy * ratio;
            tension = clamped / maxDrag;
        }
        state.pointer.currentX = effectiveX;
        state.pointer.currentY = effectiveY;
        state.pointer.tension = tension;
        state.ball.x = effectiveX;
        state.ball.y = effectiveY;
        state.ball.trail = [];
    };

    const endPointer = () => {
        if (state.pointer.pointerId !== null) {
            try {
                canvas.releasePointerCapture(state.pointer.pointerId);
            } catch (err) {
                /* ignore */
            }
        }
        state.pointer.active = false;
        state.pointer.pointerId = null;
        state.pointer.tension = 0;
    };

    canvas.addEventListener('pointerdown', (event) => {
        if (state.paused) {
            return;
        }
        if (!state.ball.ready) {
            return;
        }
        const pos = pointerToCanvas(event);
        const dist = Math.hypot(pos.x - state.ball.x, pos.y - state.ball.y);
        if (dist > state.ball.radius + 40) {
            return;
        }
        state.pointer.active = true;
        state.pointer.pointerId = event.pointerId;
        state.ball.launched = false;
        updateDraggedBallPosition(pos.x, pos.y);
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    canvas.addEventListener('pointermove', (event) => {
        if (!state.pointer.active || state.paused) {
            return;
        }
        const pos = pointerToCanvas(event);
        updateDraggedBallPosition(pos.x, pos.y);
        event.preventDefault();
    });

    const launchBall = () => {
        const launch = computeLaunchVelocity();
        if (!launch) {
            setStatus('Pull back further', 800);
            return false;
        }
        state.ball.vx = launch.vx;
        state.ball.vy = launch.vy;
        state.ball.launched = true;
        state.ball.ready = false;
        state.ball.trail = [];
        state.pointer.tension = 0;
        setStatus('Launched!', 900);
        return true;
    };

    canvas.addEventListener('pointerup', (event) => {
        if (!state.pointer.active || state.paused) {
            return;
        }
        const launched = launchBall();
        endPointer();
        if (!launched) {
            state.ball.ready = true;
            repositionBall();
        }
        playLaunchSound(Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy));
        event.preventDefault();
    });

    canvas.addEventListener('pointercancel', () => {
        endPointer();
        state.ball.ready = true;
        repositionBall();
    });

    const spawnSparkles = (x, y, count, color) => {
        for (let i = 0; i < count; i++) {
            state.sparkles.push({
                x,
                y,
                vx: randomRange(-1.5, 1.5),
                vy: randomRange(-2, -0.2),
                life: randomRange(500, 1200),
                color,
                size: randomRange(2, 5),
            });
        }
    };

    const addFloatingText = (text, x, y, color = '#fff') => {
        state.floatingTexts.push({
            text,
            x,
            y,
            life: 1200,
            color,
            vy: randomRange(-0.2, -0.05),
        });
    };

    const finishAttempt = (success) => {
        if (success) {
            state.score += 1;
            state.lifetime += 1;
            if (state.score > state.best) {
                state.best = state.score;
                storage.set(persistenceKeys.best, String(state.best));
            }
            storage.set(persistenceKeys.lifetime, String(state.lifetime));
            updateScoreboard();
            enforceAssistLock(true);
            updateAssistButtons();
            playSuccessSound();
            spawnSparkles(
                state.bucket.x + state.bucket.width / 2,
                state.bucket.y + state.bucket.depth / 2,
                30,
                state.bucket.rim
            );
            addFloatingText('Nice!', state.bucket.x + state.bucket.width / 2, state.bucket.y, '#b2f5ff');
            setStatus('Bucket!' + (state.score % 5 === 0 ? ' Hot streak!' : ''), 1600);
            randomizeBucket();
            rebuildBackdrop();
        } else {
            if (state.assists.streakShield && assistsUnlocked()) {
                addFloatingText('Shielded', state.ball.x, state.ball.y, '#b2f5ff');
                setStatus('Miss ignored — streak shield is on', 1200);
                repositionBall();
                return;
            }
            if (state.score !== 0) {
                addFloatingText('Streak reset', state.ball.x, state.ball.y, '#ffb3c1');
            }
            state.score = 0;
            updateScoreboard();
            setStatus('Missed', 1200);
        }
        repositionBall();
    };

    const quickFailAttempt = () => {
        endPointer();
        finishAttempt(false);
        setStatus('Attempt reset', 1000);
    };

    const updateSparkles = (deltaMs) => {
        state.sparkles = state.sparkles.filter((sparkle) => {
            sparkle.life -= deltaMs;
            if (sparkle.life <= 0) {
                return false;
            }
            const factor = deltaMs / 16;
            sparkle.x += sparkle.vx * factor;
            sparkle.y += sparkle.vy * factor;
            sparkle.vy += 0.02 * factor;
            return true;
        });
    };

    const updateFloatingTexts = (deltaMs) => {
        state.floatingTexts = state.floatingTexts.filter((text) => {
            text.life -= deltaMs;
            if (text.life <= 0) {
                return false;
            }
            const factor = deltaMs / 16;
            text.y += text.vy * factor * 12;
            text.vy -= 0.0007 * factor;
            return true;
        });
    };

    const updateBall = (delta) => {
        const ball = state.ball;
        if (!ball.launched) return;

        const maxStep = 0.45;
        const iterations = Math.max(1, Math.ceil(delta / maxStep));
        const dt = delta / iterations;

        const dragFactor = Math.pow(state.airDrag, dt);

        const colliders = getBucketColliders();
        const bucketImpactSound = (impact) => {
            playCollisionSound(clamp(impact / 35, 0.2, 0.9));
        };

        for (let i = 0; i < iterations; i++) {

            // -----------------------------------------
            // 1. Forces → integrate velocity
            // -----------------------------------------
            ball.vy += state.gravity * dt;

            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;


            // -----------------------------------------
            // 2. Ground collision
            // -----------------------------------------
            const ground = state.groundY;
            if (ball.trail.length > 10) {
                if (ball.y + ball.radius >= ground) {
                    const impact = Math.abs(ball.vy);
                    ball.y = ground - ball.radius;

                    if (impact < state.MIN_BOUNCE) {
                        ball.vy = 0;
                        ball.vx *= 0.7;
                        finishAttempt(false);
                        return;
                    }

                    // vertical reflection
                    ball.vy = -ball.vy * state.REST;

                    // horizontal damping on ground hit
                    ball.vx *= 0.8;

                    playCollisionSound(clamp(impact / 30, 0.2, 1));
                }
            }


            // -----------------------------------------
            // 3. Left/Right walls
            // -----------------------------------------
            if (ball.x - ball.radius < 0) {
                const impact = Math.abs(ball.vx);
                ball.x = ball.radius;

                if (impact > state.MIN_BOUNCE) {
                    ball.vx = -ball.vx * state.SIDE_REST;
                    playCollisionSound(clamp(impact / 25, 0.15, 0.8));
                } else {
                    ball.vx = 0;
                }
            }
            else if (ball.x + ball.radius > state.width) {
                const impact = Math.abs(ball.vx);
                ball.x = state.width - ball.radius;

                if (impact > state.MIN_BOUNCE) {
                    ball.vx = -ball.vx * state.SIDE_REST;
                    playCollisionSound(clamp(impact / 25, 0.15, 0.8));
                } else {
                    ball.vx = 0;
                }
            }


            // -----------------------------------------
            // 4. Ceiling
            // -----------------------------------------
            if (ball.y - ball.radius < 0) {
                const impact = Math.abs(ball.vy);
                ball.y = ball.radius;

                if (impact > state.MIN_BOUNCE) {
                    ball.vy = -ball.vy * state.REST;
                    playCollisionSound(clamp(impact / 25, 0.1, 0.6));
                } else {
                    ball.vy = 0;
                }
            }


            // -----------------------------------------
            // 5. Bucket line collisions (your function)
            // -----------------------------------------
            collideBallLine(ball, colliders.left, bucketImpactSound);
            collideBallLine(ball, colliders.right, bucketImpactSound);
            collideBallLine(ball, colliders.bottom, bucketImpactSound);


            // -----------------------------------------
            // 6. Fail borders
            // -----------------------------------------
            const failBorder = 120;
            if (
                ball.x < -failBorder ||
                ball.x > state.width + failBorder ||
                ball.y > state.height + failBorder
            ) {
                finishAttempt(false);
                return;
            }


            // -----------------------------------------
            // 7. Goal detection
            // -----------------------------------------
            const b = state.bucket;
            const r = ball.radius;

            const forgiveness = state.assists.superEasyMode ? Math.max(12, r * 0.8) : 0;

            const innerLeft = b.x + b.wall * 0.6 + r * 0.4 - forgiveness;
            const innerRight = b.x + b.width - b.wall * 0.6 - r * 0.4 + forgiveness;
            const innerTop = b.y + b.wall + r * 0.3 - forgiveness * 0.35;
            const innerBottomGoal = b.y + b.depth - b.wall - r * 0.8 + forgiveness * 0.8;

            const inX = ball.x > innerLeft && ball.x < innerRight;
            const inY = ball.y > innerTop && ball.y < innerBottomGoal;

            if (ball.vy > 0 && inX && inY) {
                finishAttempt(true);
                return;
            }

            if (state.assists.superEasyMode && ball.vy > 0 && inX) {
                const centerY = b.y + b.depth * 0.55;
                const nearBottom = ball.y > centerY && ball.y < b.y + b.depth + forgiveness * 0.4;
                if (nearBottom) {
                    finishAttempt(true);
                    return;
                }
            }


            // -----------------------------------------
            // 8. Apply drag after all collisions
            // -----------------------------------------
            ball.vx *= dragFactor;
            ball.vy *= dragFactor;
        }


        // -----------------------------------------
        // 9. Trail tracking
        // -----------------------------------------
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 60) {
            ball.trail.shift();
        }
    };


    const drawBackground = () => {
        const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
        gradient.addColorStop(0, state.background.top);
        gradient.addColorStop(1, state.background.bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, state.width, state.height);

        ctx.save();
        state.background.stars.forEach((star) => {
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        state.background.ridges.forEach((layer, index) => {
            ctx.fillStyle = layer.color;
            ctx.beginPath();
            ctx.moveTo(0, state.height);
            layer.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
            ctx.lineTo(state.width, state.height);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = `rgba(255,255,255,${0.03 * (index + 1)})`;
            layer.points.forEach((pt) => {
                ctx.fillRect(pt.x, pt.y - 1, 3, 2);
            });
        });
    };

    const drawGround = () => {
        const groundHeight = state.height - state.groundY;
        const grd = ctx.createLinearGradient(0, state.groundY - 40, 0, state.height);
        grd.addColorStop(0, 'rgba(10, 10, 18, 0)');
        grd.addColorStop(1, 'rgba(10, 10, 18, 0.95)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, state.groundY - 40, state.width, groundHeight + 40);

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        const step = 30;
        for (let x = 0; x < state.width; x += step) {
            ctx.fillRect(x, state.groundY - 4, step * 0.5, 2);
        }
    };

    const drawLaunchPad = () => {
        ctx.save();
        const baseX = state.launchOrigin.x;
        const baseY = state.groundY;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(baseX - 35, baseY + 8);
        ctx.lineTo(baseX + 35, baseY + 8);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(baseX, baseY + 2, 24, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
    };

    const drawBucket = () => {
        ctx.save();
        ctx.lineWidth = state.bucket.wall;
        ctx.strokeStyle = state.bucket.rim;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(state.bucket.x, state.bucket.y);
        ctx.lineTo(state.bucket.x, state.bucket.y + state.bucket.depth);
        ctx.moveTo(state.bucket.x + state.bucket.width, state.bucket.y);
        ctx.lineTo(state.bucket.x + state.bucket.width, state.bucket.y + state.bucket.depth);
        ctx.stroke();

        ctx.lineWidth = state.bucket.wall * 0.65;
        ctx.beginPath();
        ctx.moveTo(state.bucket.x, state.bucket.y + state.bucket.depth + 6);
        ctx.lineTo(state.bucket.x + state.bucket.width, state.bucket.y + state.bucket.depth + 6);
        ctx.stroke();

        ctx.fillStyle = state.bucket.color;
        ctx.fillRect(
            state.bucket.x + state.bucket.wall * 0.4,
            state.bucket.y + state.bucket.wall * 0.5,
            state.bucket.width - state.bucket.wall * 0.8,
            state.bucket.depth - state.bucket.wall + 10
        );
        ctx.restore();
    };

    const drawBall = () => {
        const ball = state.ball;
        ctx.save();
        const gradient = ctx.createRadialGradient(
            ball.x - ball.radius * 0.4,
            ball.y - ball.radius * 0.5,
            ball.radius * 0.2,
            ball.x,
            ball.y,
            ball.radius
        );
        gradient.addColorStop(0, '#fefefe');
        gradient.addColorStop(1, '#85a9ff');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const drawTrail = () => {
        if (!state.ball.trail.length) {
            return;
        }
        ctx.save();
        ctx.strokeStyle = 'rgba(130,180,255,0.3)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < state.ball.trail.length; i++) {
            const t = state.ball.trail[i];
            if (i === 0) {
                ctx.moveTo(t.x, t.y);
            } else {
                ctx.lineTo(t.x, t.y);
            }
        }
        ctx.stroke();
        ctx.restore();
    };

    const drawTrajectoryPreview = () => {
        if (!state.assists.showTrajectory || !assistsUnlocked()) {
            return;
        }
        if (!state.pointer.active || !state.ball.ready || state.ball.launched) {
            return;
        }

        const launch = computeLaunchVelocity();
        if (!launch) {
            return;
        }

        const ball = state.ball;
        const ground = state.groundY;

        const simBall = {
            x: state.launchOrigin.x,
            y: ground - ball.radius - 1,
            vx: launch.vx,
            vy: launch.vy,
            radius: ball.radius,
        };

        const bucketColliders = getBucketColliders();
        const points = [];
        const steps = 200;
        const dt = 1;
        const dragFactor = Math.pow(state.airDrag, dt);

        for (let i = 0; i < steps; i++) {
            simBall.vy += state.gravity * dt;
            simBall.x += simBall.vx * dt;
            simBall.y += simBall.vy * dt;

            if (simBall.y + simBall.radius >= ground) {
                const impact = Math.abs(simBall.vy);
                simBall.y = ground - simBall.radius;

                if (impact < state.MIN_BOUNCE * 0.9) {
                    simBall.vy = 0;
                    simBall.vx *= 0.7;
                    points.push({ x: simBall.x, y: simBall.y });
                    break;
                }

                simBall.vy = -simBall.vy * state.REST;
                simBall.vx *= 0.8;
            }

            if (simBall.x - simBall.radius < 0) {
                const impact = Math.abs(simBall.vx);
                simBall.x = simBall.radius;
                if (impact > state.MIN_BOUNCE) {
                    simBall.vx = -simBall.vx * state.SIDE_REST;
                } else {
                    simBall.vx = 0;
                }
            } else if (simBall.x + simBall.radius > state.width) {
                const impact = Math.abs(simBall.vx);
                simBall.x = state.width - simBall.radius;
                if (impact > state.MIN_BOUNCE) {
                    simBall.vx = -simBall.vx * state.SIDE_REST;
                } else {
                    simBall.vx = 0;
                }
            }

            if (simBall.y - simBall.radius < 0) {
                const impact = Math.abs(simBall.vy);
                simBall.y = simBall.radius;

                if (impact > state.MIN_BOUNCE) {
                    simBall.vy = -simBall.vy * state.REST;
                } else {
                    simBall.vy = 0;
                }
            }

            collideBallLine(simBall, bucketColliders.left, null);
            collideBallLine(simBall, bucketColliders.right, null);
            collideBallLine(simBall, bucketColliders.bottom, null);

            simBall.vx *= dragFactor;
            simBall.vy *= dragFactor;

            if (i % 2 === 0) {
                points.push({ x: simBall.x, y: simBall.y });
            }

            if (
                simBall.x < -simBall.radius * 2 ||
                simBall.x > state.width + simBall.radius * 2 ||
                simBall.y > state.height + simBall.radius * 2
            ) {
                break;
            }
        }

        if (!points.length) {
            return;
        }

        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(191,219,254,0.8)';
        ctx.beginPath();
        ctx.moveTo(state.launchOrigin.x, ground - ball.radius - 1);
        for (let i = 0; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const last = points[points.length - 1];
        ctx.fillStyle = 'rgba(191,219,254,0.9)';
        ctx.beginPath();
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const drawAim = () => {
        if (!state.pointer.active) {
            return;
        }
        const anchorX = state.launchOrigin.x;
        const anchorY = state.launchOrigin.y;
        const currentX = state.pointer.currentX;
        const currentY = state.pointer.currentY;
        const distance = Math.hypot(currentX - anchorX, currentY - anchorY);
        if (distance < 1) {
            return;
        }
        const normalized = clamp(distance / getMaxDragDistance(), 0, 1);
        const width = clamp(12 - normalized * 7, 3, 12);
        ctx.save();
        const gradient = ctx.createLinearGradient(anchorX, anchorY, currentX, currentY);
        gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
        gradient.addColorStop(1, 'rgba(80,150,255,0.2)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(anchorX, anchorY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(currentX, currentY, clamp(6 + normalized * 4, 6, 10), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const drawSparkles = () => {
        ctx.save();
        state.sparkles.forEach((sparkle) => {
            ctx.globalAlpha = clamp(sparkle.life / 1200, 0, 1);
            ctx.fillStyle = sparkle.color;
            ctx.beginPath();
            ctx.arc(
                sparkle.x,
                sparkle.y,
                sparkle.size * (sparkle.life / 1200 + 0.2),
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
        ctx.restore();
    };

    const drawFloatingTexts = () => {
        ctx.save();
        ctx.font = '700 18px "Inter", system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        state.floatingTexts.forEach((floating) => {
            const alpha = clamp(floating.life / 1200, 0, 1);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = floating.color;
            ctx.fillText(floating.text, floating.x, floating.y);
        });
        ctx.restore();
    };

    const render = () => {
        drawBackground();
        drawGround();
        drawLaunchPad();
        drawBucket();
        drawTrajectoryPreview();
        drawTrail();
        drawBall();
        drawAim();
        drawSparkles();
        drawFloatingTexts();
    };

    const update = (timestamp) => {
        const deltaMs = timestamp - state.lastTime;
        const delta = Math.min(deltaMs / (1000 / 60), 2.5);
        state.lastTime = timestamp;

        if (state.statusTimer > 0) {
            state.statusTimer -= deltaMs;
            if (state.statusTimer <= 0) {
                statusBadge.textContent = '';
            }
        }

        updateNowPlayingBadge(deltaMs);

        if (state.paused) {
            return;
        }

        updateSparkles(deltaMs);
        updateFloatingTexts(deltaMs);
        updateBall(delta);
    };

    const tick = (timestamp) => {
        update(timestamp);
        render();
        requestAnimationFrame(tick);
    };

    setStatus('Press, pull, and release the orb to score! Pause for audio + training wheels.', 3200);
    requestAnimationFrame(tick);
})();
