'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
export default function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const sync=()=>{let saved:string|null=null;try{saved=localStorage.getItem('livre-theme')}catch{}const next=saved?saved==='dark':media.matches;document.documentElement.dataset.theme=next?'dark':'light';setDark(next)};sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[]);
 return <button className="theme-toggle" aria-label={dark?'Ativar modo claro':'Ativar modo noturno'} title={dark?'Modo claro':'Modo noturno'} onClick={()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem('livre-theme',next?'dark':'light')}catch{}}}>{dark?<Sun size={20}/>:<Moon size={20}/>}</button>
}
