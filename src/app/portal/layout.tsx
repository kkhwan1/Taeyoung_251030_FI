/**
 * Portal Layout
 *
 * Root layout for portal pages (/portal/*)
 */

import { ReactNode } from 'react';

export const metadata = {
  title: '태창 ERP 거래처 포털',
  description: '고객사 및 공급사 전용 포털 시스템',
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
