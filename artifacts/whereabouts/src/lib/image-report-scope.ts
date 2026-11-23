import {isLegacyRecreationReport} from './recreation-purpose';
import {isVideoInvestigation} from './video-analysis';
export function isImageGeolocationReport(item:{desk?:string;contentType?:string|null;analysis?:{media_type?:string}|null}){
  return !isVideoInvestigation(item)&&item.desk!=='fake-news'&&!isLegacyRecreationReport(item);
}
