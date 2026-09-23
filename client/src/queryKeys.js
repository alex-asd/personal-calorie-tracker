export const queryKeys = {
  sessions: {
    all: ['sessions'],
    current: () => ['sessions', 'current'],
    list: () => ['sessions', 'list'],
    detail: (id) => ['sessions', 'detail', id],
    days: (id) => ['sessions', 'detail', id, 'days'],
  },
  meals: {
    all: ['meals'],
    list: (date) => ['meals', date],
  },
  savedMeals: {
    list: () => ['savedMeals'],
  },
  categories: {
    list: () => ['categories'],
  },
  weights: {
    all: ['weights'],
    history: (sessionId) => ['weights', 'history', sessionId],
  },
  activities: {
    list: () => ['activities'],
  },
  activityLogs: {
    all: ['activityLogs'],
    list: (sessionId, date) => ['activityLogs', sessionId, date],
  },
};
