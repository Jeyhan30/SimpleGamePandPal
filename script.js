// Import RxJS operators
const { fromEvent, interval, merge, NEVER } = rxjs;
const { map, filter, startWith, scan, distinctUntilChanged, switchMap } = rxjs.operators;

// Import XState
const { createMachine, interpret } = XState;

// Create the Panda State Machine
const pandaMachine = createMachine({
  context: {
    eat: 100,
    name: "No Name",
    health: 100,
  },
  id: "simplePandaPal",
  initial: "idle",
  states: {
    idle: {
      on: {
        FEED_PANDA: {
          target: "eating",
          actions: {
            type: "resetEatAndHealth",
          },
        },
        CHANGE_NAME: {
          actions: {
            type: "changePandaName",
          },
        },
      },
      after: {
        1000: {
          target: "idle",
          actions: {
            type: "decreaseEat",
          },
          cond: {
            type: "isNotEatZero",
          },
        },
      },
      always: {
        target: "lapar",
        cond: {
          type: "isEatZero",
        },
      },
    },
    eating: {
      after: {
        1000: {
          target: "idle",
        },
      },
    },
    lapar: {
      on: {
        FEED_PANDA: {
          target: "eating",
          actions: {
            type: "resetEatAndHealth",
          },
        },
      },
      after: {
        1000: {
          target: "lapar",
          actions: {
            type: "decreaseHealth",
          },
          cond: {
            type: "isNotHealthZero",
          },
        },
      },
      always: {
        target: "dead",
        cond: {
          type: "isHealthZero",
        },
      },
    },
    dead: {
      type: "final",
    },
  },
}, {
  actions: {
    resetEatAndHealth: (context, event) => {
      context.eat = 100;
      context.health = 100;
    },
    changePandaName: (context, event) => {
      context.name = event.newName || "No Name";
    },
    decreaseEat: (context, event) => {
      context.eat = Math.max(0, context.eat - 20);
    },
    decreaseHealth: (context, event) => {
      context.health = Math.max(0, context.health - 20);
    },
  },
  guards: {
    isEatZero: (context, event) => {
      return context.eat === 0;
    },
    isNotEatZero: (context, event) => {
      return context.eat > 0;
    },
    isHealthZero: (context, event) => {
      return context.health === 0;
    },
    isNotHealthZero: (context, event) => {
      return context.health > 0;
    },
  },
});

// Helper function to update progress bars with smooth animation
function updateProgressBar(fillElement, value, normalColor, criticalColor) {
  const percentage = Math.max(0, Math.min(100, value));
  const isCritical = percentage <= 20;
  const color = isCritical ? criticalColor : normalColor;
  
  // Apply smooth width transition
  fillElement.style.width = `${percentage}%`;
  fillElement.style.backgroundColor = color;
  
  // Add/remove critical class for additional animations
  if (isCritical) {
    fillElement.classList.add('critical');
  } else {
    fillElement.classList.remove('critical');
  }
  
  // Special animation when bar fills up to 100% (after feeding)
  if (percentage === 100) {
    fillElement.classList.add('feeding');
    setTimeout(() => {
      fillElement.classList.remove('feeding');
    }, 1200); // Remove after animation completes
  }
}
const pandaNameDisplay = document.getElementById('pandaNameDisplay');
const hungryFill = document.getElementById('hungryFill');
const healthFill = document.getElementById('healthFill');
const pandaGif = document.getElementById('pandaGif');
const feedMeButton = document.getElementById('feedMeButton');
const nameInput = document.getElementById('nameInput');
const changeNameButton = document.getElementById('changeNameButton');
const container = document.querySelector('.container');

// Create and start the state machine service
const pandaService = interpret(pandaMachine);

// RxJS Observables for user interactions
const feedClick$ = fromEvent(feedMeButton, 'click').pipe(
  map(() => ({ type: 'FEED_PANDA' }))
);

const nameChange$ = fromEvent(changeNameButton, 'click').pipe(
  map(() => ({ 
    type: 'CHANGE_NAME', 
    newName: nameInput.value.trim() || "No Name" 
  }))
);

// Also handle Enter key on name input
const nameInputEnter$ = fromEvent(nameInput, 'keypress').pipe(
  filter(event => event.key === 'Enter'),
  map(() => ({ 
    type: 'CHANGE_NAME', 
    newName: nameInput.value.trim() || "No Name" 
  }))
);

// Merge all user interactions
const userInteractions$ = merge(feedClick$, nameChange$, nameInputEnter$);

// State machine observable
const state$ = new rxjs.BehaviorSubject(pandaService.state);

// Update UI based on state changes
function updateUI(state) {
  const { context, value: currentState } = state;
  
  // Update panda name
  pandaNameDisplay.textContent = context.name;
  
  // Update progress bars with smooth animation
  updateProgressBar(hungryFill, context.eat, '#f7d046', '#ff4d4d');
  updateProgressBar(healthFill, context.health, '#4CAF50', '#ff4d4d');
  
  // Update panda animation based on state
  switch(currentState) {
    case 'idle':
    case 'eating':
      pandaGif.src = 'assets/panda_idle.gif';
      break;
    case 'lapar':
      pandaGif.src = 'assets/panda_rolling.gif';
      break;
    case 'dead':
      pandaGif.src = 'assets/panda_dead.gif';
      break;
  }
  
  // Handle dead state UI
  if (currentState === 'dead') {
    container.classList.add('dead-state');
    feedMeButton.disabled = true;
    changeNameButton.disabled = true;
    nameInput.disabled = true;
    
    // Show game over message
    if (!document.querySelector('.game-over-message')) {
      const gameOverMsg = document.createElement('div');
      gameOverMsg.className = 'game-over-message';
      gameOverMsg.textContent = 'GAME OVER';
      gameOverMsg.style.display = 'block';
      document.body.appendChild(gameOverMsg);
    }
  } else {
    container.classList.remove('dead-state');
    feedMeButton.disabled = false;
    changeNameButton.disabled = false;
    nameInput.disabled = false;
    
    // Hide game over message
    const gameOverMsg = document.querySelector('.game-over-message');
    if (gameOverMsg) {
      gameOverMsg.remove();
    }
  }
  
  // Clear name input after name change
  if (nameInput.value.trim() && context.name === nameInput.value.trim()) {
    nameInput.value = '';
  }
}

// Initialize the application
function initializePandaPal() {
  // Start the state machine
  pandaService.start();
  
  // Subscribe to state changes
  pandaService.onTransition(state => {
    state$.next(state);
  });
  
  // Subscribe to user interactions and send events to state machine
  userInteractions$.subscribe(event => {
    pandaService.send(event);
  });
  
  // Subscribe to state changes and update UI
  state$.subscribe(state => {
    updateUI(state);
  });
  
  // Initial UI update
  updateUI(pandaService.state);
  
  console.log('🐼 Panda Pal initialized successfully!');
  console.log('Current state:', pandaService.state.value);
  console.log('Context:', pandaService.state.context);
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePandaPal);
} else {
  initializePandaPal();
}

// Optional: Add some debugging helpers
window.pandaDebug = {
  getState: () => pandaService.state,
  getContext: () => pandaService.state.context,
  sendEvent: (event) => pandaService.send(event),
  forceState: (stateName) => {
    // For debugging purposes
    console.log(`Forcing state to: ${stateName}`);
  }
};