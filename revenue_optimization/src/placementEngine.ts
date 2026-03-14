export interface Ad {
    adId: string;
    advertiserId: string;
    timeReceived: number;
    timeout: number;
    duration: number;
    baseRevenue: number;
    bannedLocations: string[];
}

export interface Area {
    areaId: string;
    location: string;
    multiplier: number;
    totalScreens: number;
    timeWindow: number;
}

export interface ScheduledAd {
    adId: string;
    areaId: string;
    startTime: number;
    endTime: number;
}

export type Schedule = Record<string, ScheduledAd[]>;

export class PlacementEngine {

    constructor() {
    }

    isAdCompatibleWithArea(ad: Ad, area: Area): boolean {
        for(let i = 0; i < ad.bannedLocations.length; i++){
            if (ad.bannedLocations[i] === area.location) { //checking if this is in the array of bannedLocations
                return false; 
            }
        }
        return true;
    }

    getTotalScheduledTimeForArea(areaSchedule: ScheduledAd[]): number {
        let totalDur = 0;
        for (const item of areaSchedule) {
            const time = item.endTime - item.startTime;
            totalDur = totalDur + time;
        }
        return totalDur;
    }

    doesPlacementFitTimingConstraints(
        ad: Ad,
        area: Area,
        startTime: number
    ): boolean {

        if (startTime < 0) { //checking if startTime is valid
            return false;
        }

        //checking window constraints (timeReceived + timeout)
        const latestPossible = ad.timeReceived + ad.timeout;
        if (startTime < ad.timeReceived || startTime > latestPossible) {
            return false;
        }
        //time + duration shoulnt exceed the window
        if (startTime + ad.duration > area.timeWindow) { //
            return false;
        }

        return true;
    }

    isAdAlreadyScheduled(adId: string, schedule: Schedule): boolean {
        const everyArea = Object.keys(schedule);
        
        for (const e of everyArea) {
            const adsInThisArea = schedule[e];
            for (const scheduled of adsInThisArea) {
                if (scheduled.adId === adId) { //if the ad is already scheduled
                    return true; 
                }
            }
        }
        return false;
    }

    canScheduleAd(
        ad: Ad,
        area: Area,
        schedule: Schedule,
        startTime: number
    ): boolean {
       
        //CHECKING CONSTRAINTS FIRST
        // if it si not compatible, then false
        if (this.isAdCompatibleWithArea(ad, area) === false) return false;

        // if it is already scheduled somewhere already, then false
        if (this.isAdAlreadyScheduled(ad.adId, schedule)) return false;

        // checking if it fits the window
        if (!this.doesPlacementFitTimingConstraints(ad, area, startTime)) return false;

        //checking if it overlaps with other ads
        const currentAds = schedule[area.areaId] || [];
        const myEndTime = startTime + ad.duration;

        for (let j = 0; j < currentAds.length; j++) {
            const otherAd = currentAds[j];
            if (startTime < otherAd.endTime && otherAd.startTime < myEndTime) {
                return false;
            }
        }

        return true;
    }

    isAreaScheduleValid(area: Area, areaSchedule: ScheduledAd[], ads: Ad[]): boolean {

        if (this.getTotalScheduledTimeForArea(areaSchedule) > area.timeWindow) {
            return false; //ad cant run if its out of the schedule of this area
        }

        //sorting with start times
        const sortedAds = [...areaSchedule].sort((a, b) => {
            return a.startTime - b.startTime;
        });

        for (let i = 0; i < sortedAds.length; i++) {
            const sAd = sortedAds[i];
            
            let adData = null;
            for (const a of ads) {
                if (a.adId === sAd.adId) {
                    adData = a;
                    break;
                }
            }

            if (!adData) return false;

            //checking compatibility
            if (!this.isAdCompatibleWithArea(adData, area)) return false;

            //checking duration
            const actualDuration = sAd.endTime - sAd.startTime;
            if (actualDuration !== adData.duration) return false;

            //checking boundary
            if (sAd.endTime > area.timeWindow) return false;

            //making sure this ad is not stretching to another
            if (i < sortedAds.length - 1) {
                const nextAd = sortedAds[i + 1];
                if (sAd.endTime > nextAd.startTime) {
                    return false;
                }
            }
        }

        return true;
    }

    
}