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
        return !ad.bannedLocations.includes(area.location);
    }

    getTotalScheduledTimeForArea(areaSchedule: ScheduledAd[]): number {
        return areaSchedule.reduce((sum, sAd) => sum + (sAd.endTime - sAd.startTime), 0);
    }

    doesPlacementFitTimingConstraints(
        ad: Ad,
        area: Area,
        startTime: number
    ): boolean {
        if (startTime < 0) return false;

        const latestStart = ad.timeReceived + ad.timeout;
        if (startTime < ad.timeReceived || startTime > latestStart) return false;

        const endTime = startTime + ad.duration;
        if (endTime > area.timeWindow) return false;

        return true;
    }

    isAdAlreadyScheduled(adId: string, schedule: Schedule): boolean {
        return Object.values(schedule).some((areaAds) => 
            areaAds.some((sAd) => sAd.adId === adId)
        );
    }

    canScheduleAd(
        ad: Ad,
        area: Area,
        schedule: Schedule,
        startTime: number
    ): boolean {
       
        if (!this.isAdCompatibleWithArea(ad, area)) return false;

        if (this.isAdAlreadyScheduled(ad.adId, schedule)) return false;

        if (!this.doesPlacementFitTimingConstraints(ad, area, startTime)) return false;

        const targetAreaSchedule = schedule[area.areaId] || [];
        const newEnd = startTime + ad.duration;

        for (const existing of targetAreaSchedule) {
            // Overlap if: StartA < EndB AND StartB < EndA
            if (startTime < existing.endTime && existing.startTime < newEnd) {
                return false;
            }
        }

        return true;
    }

    isAreaScheduleValid(area: Area, areaSchedule: ScheduledAd[], ads: Ad[]): boolean {
        if (this.getTotalScheduledTimeForArea(areaSchedule) > area.timeWindow) return false;

         const sorted = [...areaSchedule].sort((a, b) => a.startTime - b.startTime);

        for (let i = 0; i < sorted.length; i++) {
            const sAd = sorted[i];
            const adMetadata = ads.find((a) => a.adId === sAd.adId);

            if (!adMetadata) return false;

            if (!this.isAdCompatibleWithArea(adMetadata, area)) return false;

            if (sAd.endTime - sAd.startTime !== adMetadata.duration) return false;

            if (sAd.endTime > area.timeWindow) return false;

            if (i < sorted.length - 1) {
                if (sAd.endTime > sorted[i + 1].startTime) return false;
            }
        }

        return true;
    }

    calculateScheduleMetrics(schedule: Schedule, ads: Ad[], areas: Area[], decayRate: number) {
        const flattened: Array<{ sAd: ScheduledAd; ad: Ad; area: Area; rawRevenue: number }> = [];
        const areaMap = new Map(areas.map(a => [a.areaId, a]));
        const adMap = new Map(ads.map(a => [a.adId, a]));

        // valuidtion
        for (const areaId in schedule) {
            const area = areaMap.get(areaId);
            if (!area) continue;
            for (const sAd of schedule[areaId]) {
                const ad = adMap.get(sAd.adId);
                if (!ad) continue;
                flattened.push({
                    sAd,
                    ad,
                    area,
                    rawRevenue: ad.baseRevenue * area.multiplier
                });
            }
        }

        //sorting
        flattened.sort((a, b) => {
            if (a.sAd.startTime !== b.sAd.startTime) return a.sAd.startTime - b.sAd.startTime;
            if (a.rawRevenue !== b.rawRevenue) return a.rawRevenue - b.rawRevenue;
            return a.ad.adId.localeCompare(b.ad.adId);
        });

        //decay logic added
        let totalRevenue = 0;
        const advertiserCounts = new Map<string, number>();
        const uniqueAdvertisers = new Set<string>();
        let totalScheduledDuration = 0;

        for (const item of flattened) {
            const count = advertiserCounts.get(item.ad.advertiserId) || 0;
            const multiplier = Math.pow(decayRate, count);
            
            totalRevenue += item.rawRevenue * multiplier;
            totalScheduledDuration += (item.sAd.endTime - item.sAd.startTime);
            
            advertiserCounts.set(item.ad.advertiserId, count + 1);
            uniqueAdvertisers.add(item.ad.advertiserId);
        }

        const totalPotentialTime = areas.reduce((sum, a) => sum + a.timeWindow, 0);
        
        return {
            totalRevenue,
            unusedTime: totalPotentialTime - totalScheduledDuration,
            diversity: uniqueAdvertisers.size
        };
    }

    compareSchedules(
        schedA: Schedule,
        schedB: Schedule,
        ads: Ad[],
        areas: Area[],
        decayRate: number
    ): number {
        const metricsA = this.calculateScheduleMetrics(schedA, ads, areas, decayRate);
        const metricsB = this.calculateScheduleMetrics(schedB, ads, areas, decayRate);

        if (Math.abs(metricsA.totalRevenue - metricsB.totalRevenue) > 1e-9) {
            return metricsA.totalRevenue > metricsB.totalRevenue ? 1 : -1;
        }

        if (metricsA.unusedTime !== metricsB.unusedTime) {
            return metricsA.unusedTime < metricsB.unusedTime ? 1 : -1;
        }

        if (metricsA.diversity !== metricsB.diversity) {
            return metricsA.diversity > metricsB.diversity ? 1 : -1;
        }

        return 0;
    }
}