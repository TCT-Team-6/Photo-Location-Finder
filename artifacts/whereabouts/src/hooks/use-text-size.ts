import {useLayoutEffect} from 'react';
import {installTextScaling} from '@/lib/text-scaling';
import '@/styles/text-size.css';

export function useTextSize(value:number){
  useLayoutEffect(()=>installTextScaling(document,value),[value]);
}
