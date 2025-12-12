import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PlusCircle, History, Dumbbell, BarChart2, Settings } from 'lucide-react';
import clsx from 'clsx';
import styles from './Layout.module.css'; // Using CSS modules for complex layout if needed, or inline for simplicity. I'll use inline/global classes for speed where appropriate or standard CSS.

// Simple CSS Module emulation or just inline styles for the Nav
const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
    <NavLink
        to={to}
        className={({ isActive }) => clsx(
            'flex flex-col items-center justify-center w-full py-2 text-xs transition-colors',
            isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
        )}
        style={{
            color: 'var(--color-text-secondary)', // fallback
        }}
    >
        {({ isActive }) => (
            <>
                <div style={{ color: isActive ? 'var(--color-accent)' : 'inherit' }}>{icon}</div>
                <span style={{ color: isActive ? 'var(--color-accent)' : 'inherit', marginTop: '4px' }}>{label}</span>
            </>
        )}
    </NavLink>
);

export const AppShell: React.FC = () => {
    return (
        <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border h-16 flex items-center justify-around z-50">
                <NavItem to="/workout" icon={<PlusCircle size={24} />} label="Train" />
                <NavItem to="/history" icon={<History size={24} />} label="History" />
                <NavItem to="/exercises" icon={<Dumbbell size={24} />} label="Exercises" />
                <NavItem to="/stats" icon={<BarChart2 size={24} />} label="Stats" />
                <NavItem to="/settings" icon={<Settings size={24} />} label="Settings" />
            </nav>
        </div>
    );
};
