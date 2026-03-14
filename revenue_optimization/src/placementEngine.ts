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

    calculateScheduleMetrics(schedule: Schedule, ads: Ad[], areas: Area[], decayRate: number) {
        
        //easy lookup
        const areaLookup: any = {};
        for (const a of areas) { areaLookup[a.areaId] = a; }
        
        const adLookup: any = {};
        for (const a of ads) { adLookup[a.adId] = a; }

        const flatList = [];

        //details from schedule
        const areaIds = Object.keys(schedule);
        for (const aId of areaIds) {
            const areaObj = areaLookup[aId];
            if (!areaObj) continue;

            const scheduledItems = schedule[aId];
            for (const sAd of scheduledItems) {
                const adObj = adLookup[sAd.adId];
                if (!adObj) continue;

                flatList.push({
                    sAd: sAd,
                    ad: adObj,
                    area: areaObj,
                    rawRevenue: adObj.baseRevenue * areaObj.multiplier
                });
            }
        }

        // Sorting list
        flatList.sort((item1, item2) => {
            if (item1.sAd.startTime !== item2.sAd.startTime) {
                return item1.sAd.startTime - item2.sAd.startTime;
            }
            if (item1.rawRevenue !== item2.rawRevenue) {
                return item1.rawRevenue - item2.rawRevenue;
            }
            return item1.ad.adId.localeCompare(item2.ad.adId);
        });

        let finalRevenue = 0;
        let totalTimeUsed = 0;
        const advertiserSeenCount: any = {};
        const advertiserSet = new Set<string>();

        for (const item of flatList) {
            const advId = item.ad.advertiserId;
            
            //decay logic
            let timesSeen = 0;
            if (advertiserSeenCount[advId]) {
                timesSeen = advertiserSeenCount[advId];
            }
            
            const multiplier = Math.pow(decayRate, timesSeen);
            finalRevenue += item.rawRevenue * multiplier;
            
            totalTimeUsed += (item.sAd.endTime - item.sAd.startTime);
            advertiserSeenCount[advId] = timesSeen + 1;
            advertiserSet.add(advId);
        }

        let totalPotentialTime = 0;
        for (const area of areas) {
            totalPotentialTime += area.timeWindow;
        }
        
        return {
            totalRevenue: finalRevenue,
            unusedTime: totalPotentialTime - totalTimeUsed,
            diversity: advertiserSet.size
        };
    }

    compareSchedules(
        schedA: Schedule,
        schedB: Schedule,
        ads: Ad[],
        areas: Area[],
        decayRate: number
    ): number {
        const m1 = this.calculateScheduleMetrics(schedA, ads, areas, decayRate);
        const m2 = this.calculateScheduleMetrics(schedB, ads, areas, decayRate);

        const diff = m1.totalRevenue - m2.totalRevenue;
        if (Math.abs(diff) > 0.000000001) {
            if (m1.totalRevenue > m2.totalRevenue) return 1;
            else return -1;
        }

        if (m1.unusedTime !== m2.unusedTime) {
            if (m1.unusedTime < m2.unusedTime) return 1;
            else return -1;
        }

        if (m1.diversity !== m2.diversity) {
            if (m1.diversity > m2.diversity) return 1;
            else return -1;
        }

        return 0;
    }
    
}