import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignInButton } from './SignInButton';

// Mock Clerk React
vi.mock('@clerk/clerk-react', () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <div data-testid="clerk-signin">{children}</div>,
  useUser: () => ({ isSignedIn: false }),
}));

describe('SignInButton', () => {
  it('should render sign in button when not signed in', () => {
    render(<SignInButton />);
    
    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<SignInButton className="custom-class" />);
    
    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toHaveClass('custom-class');
  });

  it('should wrap button in Clerk SignInButton component', () => {
    render(<SignInButton />);
    
    expect(screen.getByTestId('clerk-signin')).toBeInTheDocument();
  });
});
