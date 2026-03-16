import React, { createContext, useContext } from 'react';

const DemoAccessContext = createContext({ isDemoAccess: false });

export function DemoAccessProvider({ isDemoAccess, children }) {
  return (
    <DemoAccessContext.Provider value={{ isDemoAccess: !!isDemoAccess }}>
      {children}
    </DemoAccessContext.Provider>
  );
}

export function useDemoAccess() {
  const ctx = useContext(DemoAccessContext);
  if (!ctx) {
    return { isDemoAccess: false };
  }
  return ctx;
}

