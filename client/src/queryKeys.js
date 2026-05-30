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
  weights: {
    today: () => ['weights', 'today'],
  },
};
