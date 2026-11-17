export const ODOMETER_CELL_EM=1.4;
export function odometerTransform(digit:string|number){
  const parsed=Number(digit),value=Number.isFinite(parsed)?Math.max(0,Math.min(9,Math.floor(parsed))):0;
  return `translateY(${-value*140/100}em)`;
}
