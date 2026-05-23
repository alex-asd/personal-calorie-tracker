export const queryKeys = {
  sessions: {
    all: ['sessions'],
    current: () => ['sessions', 'current'],
    list: () => ['sessions', 'list'],
    detail: (id) => ['sessions', 'detail', id],
    days: (id) => ['sessions', 'detail', id, 'days'],
  },
  meals: {
    list: () => ['meals'],
  },
  savedMeals: {
    list: () => ['savedMeals'],
  },
  weights: {
    today: () => ['weights', 'today'],
  },
};
