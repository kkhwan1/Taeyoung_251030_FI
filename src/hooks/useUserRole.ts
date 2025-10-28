import { useState, useEffect } from 'react';

export function useUserRole() {
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUserRole(data.user.role);
        }
      })
      .catch(err => console.error('Failed to fetch user role:', err));
  }, []);

  const canEdit = userRole !== 'accountant';
  const isAccountant = userRole === 'accountant';
  const isCEO = userRole === 'ceo';
  const isAdmin = userRole === 'admin';

  return { userRole, canEdit, isAccountant, isCEO, isAdmin };
}

