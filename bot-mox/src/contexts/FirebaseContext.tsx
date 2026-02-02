import React, { createContext, useContext, type ReactNode } from 'react';
import { Database } from 'firebase/database';
import { database } from '../utils/firebase';

interface FirebaseContextType {
  database: Database;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({ children }) => {
  return (
    <FirebaseContext.Provider value={{ database }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextType => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};