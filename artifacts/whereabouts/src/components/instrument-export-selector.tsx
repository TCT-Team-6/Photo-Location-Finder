import {useState} from 'react';
import {DeskSelector} from './desk-selector';
export default function ExportSelector(){const[value,setValue]=useState(0);return <DeskSelector value={value} onChange={setValue}/>;}
