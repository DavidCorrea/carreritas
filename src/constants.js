export var C = {
  physics: {
    maxSpeed: 280,
    acceleration: 200,
    brakeForce: 320,
    steerSpeed: 2.8,
    friction: 0.985,
    grip: 3.5
  },

  car: {
    radius: 6,
    ghostColor: 0x4da6e8,
    patterns: ['solid', 'ring', 'half', 'stripe', 'gradient', 'radial', 'spiral', 'dots', 'bullseye'],
    defaultSettings: {
      pattern: 'solid',
      primaryColor: '#e84d4d',
      secondaryColor: '#ffffff',
      headlightsColor: '#ffe0a0',
      headlightShape: 50,
      underglowColor: '#ff00ff',
      underglowOpacity: 100
    }
  },

  track: {
    width: 55,
    samples: 400,
    recordInterval: 0.1
  },

  camera: {
    viewSize: 450,
    height: 300,
    modes: ['TOP-DOWN', 'ROTATED', 'CHASE', 'ISOMETRIC'],
    previewSpeed: 0.05,
    showcase: {
      shots: [
        { duration: 6, radius: 45, height: 12, speed: 0.3, lookY: 5 },
        { duration: 7, radius: 80, height: 50, speed: -0.2, lookY: 0 },
        { duration: 5, radiusStart: 90, radiusEnd: 30, height: 18, speed: 0.15, lookY: 8 },
        { duration: 6, radius: 55, height: 30, speed: 0.25, lookY: 3 }
      ],
      transition: 1.5
    }
  },

  storage: {
    prefix: 'haxrace_ghost_',
    settingsKey: 'carreritas_settings',
    authKey: 'carreritas_auth'
  },

  share: {
    base: 'https://carreritas.vercel.app/',
    openers: [
      'Just set this time.',
      'Not bad, right?',
      'Could\'ve been worse.',
      'Not my best run... or is it?',
      'Look at this.'
    ],
    openersRecord: [
      'New record. No big deal.',
      'Just casually dropped a record.',
      'Personal best. I make it look easy.',
      'Record broken. Again.',
      'Peak performance.',
      'Cinema.',
      'This is giving main character energy.',
      'No cap, that was clean.',
      'Lowkey ate that.',
      'Slay.'
    ],
    closers: [
      'Think you can beat me?',
      'Your turn.',
      'No pressure.',
      'Your move.',
      'Beat that.'
    ],
    closersRecord: [
      'Good luck beating this.',
      'Try to do better, I dare you.',
      'I\'ll wait.',
      'Don\'t even bother.',
      'Set the bar. Your problem now.',
      'It\'s giving unbeatable.',
      'Rent free in the leaderboard.',
      'Stay mad.'
    ]
  },

  countries: []
};
