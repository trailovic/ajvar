"use client";

import {ChevronDown,KeyRound,LogOut,UserRound} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {Profile} from '@/lib/types';

const tones=['sage','clay','oat','berry','olive'] as const;

function monogram(name:string,username:string){
 const words=name.trim().split(/\s+/).filter(Boolean);
 const letters=words.length>1?[words[0],words.at(-1)!]:words.length?words:[username];
 return letters.slice(0,2).map(word=>Array.from(word)[0]?.toUpperCase()).join('')||'A';
}

function profileTone(value:string){
 const hash=Array.from(value).reduce((total,character)=>((total*31)+character.codePointAt(0)!)|0,0);
 return tones[Math.abs(hash)%tones.length];
}

type AccountMenuProps={
 profile:Profile;
 emailAuth:boolean;
 busy:boolean;
 onOpenAccount:()=>void;
 onOpenPassword:()=>void;
 onSignOut:()=>Promise<void>;
};

export default function AccountMenu({profile,emailAuth,busy,onOpenAccount,onOpenPassword,onSignOut}:AccountMenuProps){
 const initials=monogram(profile.name,profile.username);
 const tone=profileTone(profile.id||profile.username);
 return <DropdownMenu>
  <DropdownMenuTrigger asChild>
   <button className="account-menu-trigger" aria-label={`Open account menu for ${profile.name}`}>
    <span className="account-avatar" data-tone={tone} aria-hidden="true">{initials}</span>
    <ChevronDown className="account-menu-chevron" size={15} aria-hidden="true"/>
   </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="account-menu-content" align="end" sideOffset={10} collisionPadding={12}>
   <DropdownMenuLabel className="account-menu-profile">
    <span className="account-avatar account-avatar-large" data-tone={tone} aria-hidden="true">{initials}</span>
    <span className="account-menu-identity"><strong>{profile.name}</strong><span>@{profile.username}</span></span>
   </DropdownMenuLabel>
   <DropdownMenuSeparator className="account-menu-separator"/>
   <DropdownMenuItem className="account-menu-item" onSelect={onOpenAccount}>
    <UserRound aria-hidden="true"/><span>Account settings</span>
   </DropdownMenuItem>
   {emailAuth&&<DropdownMenuItem className="account-menu-item" onSelect={onOpenPassword}>
    <KeyRound aria-hidden="true"/><span>Password</span>
   </DropdownMenuItem>}
   <DropdownMenuSeparator className="account-menu-separator"/>
   {emailAuth?<DropdownMenuItem className="account-menu-item account-menu-signout" disabled={busy} onSelect={()=>void onSignOut()}>
    <LogOut aria-hidden="true"/><span>{busy?'Signing out…':'Sign out'}</span>
   </DropdownMenuItem>:<DropdownMenuItem className="account-menu-item account-menu-signout" asChild>
    <a target="_top" href="/signout-with-chatgpt?return_to=/"><LogOut aria-hidden="true"/><span>Sign out</span></a>
   </DropdownMenuItem>}
  </DropdownMenuContent>
 </DropdownMenu>;
}
