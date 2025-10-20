/**
 * Label Component
 * Reusable label for form fields with dark mode support
 */

import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
  children: React.ReactNode;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <label
        className={`
          block text-sm font-medium
          text-gray-700 dark:text-gray-300
          mb-1
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        ref={ref}
        {...props}
      >
        {children}
      </label>
    );
  }
);

Label.displayName = 'Label';
