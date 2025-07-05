// Mock Firebase services for production app without Firebase config

export const auth = () => ({
  currentUser: null,
  signInWithEmailAndPassword: () => Promise.resolve({ user: { uid: 'mock-user' } }),
  createUserWithEmailAndPassword: () => Promise.resolve({ user: { uid: 'mock-user' } }),
  signOut: () => Promise.resolve(),
  onAuthStateChanged: (callback) => {
    callback(null);
    return () => {};
  }
});

export const firestore = () => ({
  collection: (name) => ({
    doc: (id) => ({
      get: () => Promise.resolve({ exists: false, data: () => ({}) }),
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    }),
    where: () => ({
      get: () => Promise.resolve({ empty: true, docs: [] }),
      limit: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] })
      })
    }),
    add: () => Promise.resolve({ id: 'mock-id' }),
    orderBy: () => ({
      limit: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] })
      })
    })
  }),
  FieldValue: {
    increment: () => ({})
  }
});

export const storage = () => ({
  ref: () => ({
    child: () => ({
      put: () => Promise.resolve({ state: 'success' }),
      getDownloadURL: () => Promise.resolve('https://placeholder.com/image.jpg')
    })
  })
});

export const analytics = () => ({
  logEvent: () => Promise.resolve(),
  setUserId: () => Promise.resolve(),
  setUserProperties: () => Promise.resolve()
});

export default {
  auth,
  firestore,
  storage,
  analytics
};