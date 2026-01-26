import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-xl font-bold">Camping Packliste App</h1>
          {/* Basic Navigation could go here */}
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4">
        {children}
      </main>
      <footer className="bg-gray-100 p-4 text-center text-sm text-gray-600">
        © 2025 Camping Packliste App
      </footer>
    </div>
  );
}
