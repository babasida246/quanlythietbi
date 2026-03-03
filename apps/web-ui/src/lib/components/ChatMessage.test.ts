/**
 * ChatMessage Component Tests
 * Tests message rendering, user/assistant display, timestamp formatting
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ChatMessage from './ChatMessage.svelte';

const mockUserMessage = {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Hello, how are you?',
    createdAt: '2024-01-15T10:30:00Z',
    conversationId: 'conv-1'
};

const mockAssistantMessage = {
    id: 'msg-2',
    role: 'assistant' as const,
    content: 'I am doing well, thank you for asking!',
    createdAt: '2024-01-15T10:30:30Z',
    conversationId: 'conv-1'
};

describe('ChatMessage Component', () => {
    describe('Rendering', () => {
        it('should render message content', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            expect(container.textContent).toContain('Hello, how are you?');
        });

        it('should render user message', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            expect(container).toBeTruthy();
            expect(container.querySelector('.bg-blue-600')).toBeTruthy();
        });

        it('should render assistant message', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockAssistantMessage }
            });

            expect(container).toBeTruthy();
            expect(container.querySelector('.bg-gray-700')).toBeTruthy();
        });

        it('should display timestamp', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            // Should contain time text
            const timePattern = /\d{1,2}:\d{2}/;
            expect(container.textContent).toMatch(timePattern);
        });
    });

    describe('User vs Assistant Styling', () => {
        it('should align user messages to the right', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            const wrapper = container.querySelector('.flex');
            expect(wrapper?.classList.contains('flex-row-reverse')).toBe(true);
        });

        it('should align assistant messages to the left', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockAssistantMessage }
            });

            const wrapper = container.querySelector('.flex');
            expect(wrapper?.classList.contains('flex-row')).toBe(true);
        });

        it('should show User icon for user messages', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            // Check for user avatar
            const avatar = container.querySelector('.bg-blue-600');
            expect(avatar).toBeTruthy();
        });

        it('should show Bot icon for assistant messages', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockAssistantMessage }
            });

            // Check for bot avatar
            const avatar = container.querySelector('.bg-gray-700');
            expect(avatar).toBeTruthy();
        });
    });

    describe('Message Content', () => {
        it('should preserve whitespace in content', () => {
            const messageWithNewlines = {
                ...mockAssistantMessage,
                content: 'Line 1\nLine 2\nLine 3'
            };

            const { container } = render(ChatMessage, {
                props: { message: messageWithNewlines }
            });

            const contentDiv = container.querySelector('.whitespace-pre-wrap');
            expect(contentDiv).toBeTruthy();
        });

        it('should handle long content', () => {
            const longMessage = {
                ...mockUserMessage,
                content: 'A'.repeat(1000)
            };

            const { container } = render(ChatMessage, {
                props: { message: longMessage }
            });

            expect(container.textContent).toContain('A'.repeat(100));
        });

        it('should handle special characters', () => {
            const specialMessage = {
                ...mockUserMessage,
                content: '<script>alert("xss")</script>'
            };

            const { container } = render(ChatMessage, {
                props: { message: specialMessage }
            });

            // Should escape HTML
            expect(container.querySelector('script')).toBeNull();
            expect(container.textContent).toContain('<script>');
        });

        it('should handle empty content', () => {
            const emptyMessage = {
                ...mockUserMessage,
                content: ''
            };

            const { container } = render(ChatMessage, {
                props: { message: emptyMessage }
            });

            expect(container).toBeTruthy();
        });
    });

    describe('Timestamp Formatting', () => {
        it('should format timestamp correctly', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            // Should have a small text for time
            const timeElement = container.querySelector('.text-xs.text-gray-500');
            expect(timeElement).toBeTruthy();
        });

        it('should handle invalid date gracefully', () => {
            const invalidDateMessage = {
                ...mockUserMessage,
                createdAt: 'invalid-date'
            };

            // Should not throw
            expect(() => {
                render(ChatMessage, {
                    props: { message: invalidDateMessage }
                });
            }).not.toThrow();
        });
    });

    describe('Accessibility', () => {
        it('should have proper structure for screen readers', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            // Message content should be readable
            expect(container.textContent).toContain('Hello, how are you?');
        });

        it('should have visible avatar', () => {
            const { container } = render(ChatMessage, {
                props: { message: mockUserMessage }
            });

            const avatar = container.querySelector('.rounded-full');
            expect(avatar).toBeTruthy();
        });
    });
});
