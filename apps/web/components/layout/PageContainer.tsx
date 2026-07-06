/**
 * PageContainer - Consistent padding and spacing for all pages
 */

import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  /** Max width constraint (default: 7xl) */
  maxWidth?: "full" | "7xl" | "6xl" | "5xl" | "4xl";
  /** Remove horizontal padding (for full-width content) */
  noPadding?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const maxWidthClasses = {
  full: "",
  "7xl": "max-w-7xl",
  "6xl": "max-w-6xl",
  "5xl": "max-w-5xl",
  "4xl": "max-w-4xl",
};

export function PageContainer({
  children,
  maxWidth = "7xl",
  noPadding = false,
  className = "",
}: PageContainerProps) {
  const paddingClass = noPadding ? "" : "px-4 sm:px-6 lg:px-8";
  const widthClass = maxWidthClasses[maxWidth];

  return (
    <div className={`page-container ${paddingClass} ${className}`}>
      <div className={`${widthClass} mx-auto`}>{children}</div>
    </div>
  );
}

/**
 * PageHeader - Consistent page title section
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      {breadcrumb && <div className="mb-4">{breadcrumb}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/**
 * PageSection - Content section with optional title
 */
interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function PageSection({
  children,
  title,
  description,
  className = "",
}: PageSectionProps) {
  return (
    <section className={`page-section ${className}`}>
      {(title || description) && (
        <div className="mb-6">
          {title && <h2 className="section-title">{title}</h2>}
          {description && <p className="section-description">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Card - Elevated content card
 */
interface CardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({
  children,
  className = "",
  noPadding = false,
}: CardProps) {
  const paddingClass = noPadding ? "" : "p-6";
  return <div className={`card ${paddingClass} ${className}`}>{children}</div>;
}
