import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { User, Store, Shield, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function RoleSwitcher() {
  const navigate = useNavigate();
  const utils = trpc.useContext();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: merchantProfile } = trpc.merchant.getMyMerchantProfile.useQuery();
  const [isOpen, setIsOpen] = useState(false);

  const switchRoleMutation = trpc.merchant.switchRole.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh user data
      utils.auth.me.invalidate();
      utils.merchant.getMyMerchantProfile.invalidate();
      
      // Navigate to appropriate dashboard
      if (user?.role === 'user') {
        navigate('/merchant/dashboard');
      } else {
        navigate('/dashboard');
      }
    },
  });

  if (!user) {
    return null;
  }

  // Only show role switcher if user has a merchant account
  const hasMerchantAccount = merchantProfile && merchantProfile.status === 'active';
  
  if (!hasMerchantAccount && user.role !== 'admin') {
    return null;
  }

  const handleSwitchRole = (targetRole: 'user' | 'merchant' | 'admin') => {
    if (targetRole === user.role) {
      setIsOpen(false);
      return;
    }

    switchRoleMutation.mutate({ targetRole });
    setIsOpen(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'merchant':
        return <Store className="h-4 w-4" />;
      case 'user':
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'merchant':
        return 'Merchant';
      case 'user':
      default:
        return 'Personal';
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {getRoleIcon(user.role)}
          <span className="hidden sm:inline">{getRoleLabel(user.role)}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleSwitchRole('user')}
          className="cursor-pointer"
        >
          <User className="h-4 w-4 mr-2" />
          <span>Personal Account</span>
          {user.role === 'user' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>

        {hasMerchantAccount && (
          <DropdownMenuItem
            onClick={() => handleSwitchRole('merchant')}
            className="cursor-pointer"
          >
            <Store className="h-4 w-4 mr-2" />
            <span>Merchant Account</span>
            {user.role === 'merchant' && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        )}

        {user.role === 'admin' && (
          <DropdownMenuItem
            onClick={() => handleSwitchRole('admin')}
            className="cursor-pointer"
          >
            <Shield className="h-4 w-4 mr-2" />
            <span>Administrator</span>
            {user.role === 'admin' && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        
        {!hasMerchantAccount && user.role !== 'admin' && (
          <DropdownMenuItem
            onClick={() => {
              navigate('/merchant/apply');
              setIsOpen(false);
            }}
            className="cursor-pointer text-blue-600"
          >
            <Store className="h-4 w-4 mr-2" />
            <span>Become a Merchant</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
