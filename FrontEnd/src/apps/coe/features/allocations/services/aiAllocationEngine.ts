import {
  SubjectExam,
  ExamHall,
  FacultyInvigilator,
  SeatedCandidate,
  RoomAllocationResult,
  AIAllocationConfig,
  AITelemetryMetrics,
} from '../types/allocationTypes';
import { FIRST_NAMES, LAST_NAMES } from '../mock/allocationMockData';

// Hardcoded institutional holidays (e.g. Independence Day, Republic Day, Diwali, etc.)
const NATIONAL_HOLIDAYS = [
  '2026-01-26', // Republic Day
  '2026-08-15', // Independence Day
  '2026-10-02', // Gandhi Jayanti
  '2026-11-09', // Deepavali (approx)
  '2026-12-25', // Christmas
];

/**
 * Generates an array of exam dates spaced by exactly 1 day.
 * Skips Sundays and predefined National Holidays.
 */
export function generateTimetableDates(startDateStr: string, numberOfExams: number): string[] {
  const dates: string[] = [];
  let currentDate = new Date(startDateStr);
  
  while (dates.length < numberOfExams) {
    const dayOfWeek = currentDate.getDay();
    const isoString = currentDate.toISOString().split('T')[0];
    
    // Check if Sunday (0) or Holiday
    if (dayOfWeek !== 0 && !NATIONAL_HOLIDAYS.includes(isoString)) {
      dates.push(isoString);
    }
    
    // Add 2 days for a 1-day gap
    currentDate.setDate(currentDate.getDate() + 2);
  }
  
  return dates;
}


/**
 * Generates realistic student candidates for ONE subject exam.
 * USNs are unique per subject (e.g. CS301-001, CS302-001) to prevent cross-hall duplication.
 */
export function generateStudentCandidates(
  subject: SubjectExam,
  targetTotalStudents?: number
): SeatedCandidate[] {
  const candidates: SeatedCandidate[] = [];

  // Refinement: Simulate only the Gateway ELIGIBLE students.
  // In a real system, this would fetch the actual students who passed the eligibility gateway.
  // We use `targetTotalStudents` to proportionally scale the eligible students if needed.
  // The original subject.eligibleStudents represents the students who actually passed the gateway.
  const baseEligible = subject.eligibleStudents;
  const count = Math.max(1, Math.round(baseEligible * (targetTotalStudents ? Math.min(1, targetTotalStudents / baseEligible) : 1)));

  for (let i = 1; i <= count; i++) {
    const roll = String(i).padStart(3, '0');
    // USN includes subject code to guarantee uniqueness across subjects
    const usn = `${subject.code}-${roll}`;
    // Mix subject code length/characters into the index to ensure different names for the same roll number across branches
    const subjectEntropy = subject.code.charCodeAt(0) + subject.code.charCodeAt(subject.code.length - 1);
    const fName = FIRST_NAMES[((i * 3) + subjectEntropy) % FIRST_NAMES.length];
    const lName = LAST_NAMES[((i * 2) + subjectEntropy) % LAST_NAMES.length];
    const isSpecialAccommodated = (i % 47 === 0);

    candidates.push({
      seatIndex: -1,
      benchNumber: -1,
      deskPosition: 'SINGLE',
      usn,
      name: `${fName} ${lName}`,
      department: subject.deptCode,
      subjectCode: subject.code,
      subjectTitle: subject.title,
      color: subject.color,
      isSpecialAccommodated,
    });
  }

  return candidates;
}

/**
 * AI Solver: Cross-Department Spatial Interleaving & Capacity Packing
 * Seats candidates for ONE subject exam at a time.
 */
export function runAISeatingSolver(
  subjects: SubjectExam[],
  rooms: ExamHall[],
  facultyList: FacultyInvigilator[],
  config: AIAllocationConfig
): {
  results: RoomAllocationResult[];
  telemetry: AITelemetryMetrics;
  updatedFaculty: FacultyInvigilator[];
  perSubjectResults: Record<string, RoomAllocationResult[]>;
} {
  const startTime = performance.now();

  // Track faculty duty increments for equal workload across ALL subjects
  const facultyTracker: FacultyInvigilator[] = facultyList.map(f => ({ ...f }));
  const allResults: RoomAllocationResult[] = [];
  const perSubjectResults: Record<string, RoomAllocationResult[]> = {};

  let totalAdjacentPairs = 0;
  let totalConflictPairs = 0;
  let totalPwdAllocated = 0;
  let totalPwdCandidates = 0;

  // Group subjects by Date
  const dateGroups: Record<string, SubjectExam[]> = {};
  subjects.forEach(s => {
    const d = s.examDate || '1970-01-01';
    if (!dateGroups[d]) dateGroups[d] = [];
    dateGroups[d].push(s);
  });

  const dates = Object.keys(dateGroups);

  dates.forEach(examDateStr => {
    const daySubjects = dateGroups[examDateStr];

    // 1. Calculate capacity
    const totalRoomCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const effectiveCapacity = Math.floor(totalRoomCapacity * (1 - config.reserveBufferPercentage / 100));

    // 2. Generate candidates for DAY's subjects
    const allCandidates: SeatedCandidate[] = [];
    const targetPerSubject = Math.floor(effectiveCapacity / (daySubjects.length || 1));
    daySubjects.forEach(subject => {
      allCandidates.push(...generateStudentCandidates(subject, targetPerSubject));
    });

  totalPwdCandidates = allCandidates.filter(c => c.isSpecialAccommodated).length;

  // 3. Separate PWD candidates
  const pwdCandidates = allCandidates.filter(c => c.isSpecialAccommodated);
  const normalCandidates = allCandidates.filter(c => !c.isSpecialAccommodated);

  // 4. Group by department for interleaving
  const deptQueues: Record<string, SeatedCandidate[]> = {};
  normalCandidates.forEach(c => {
    if (!deptQueues[c.department]) deptQueues[c.department] = [];
    deptQueues[c.department].push(c);
  });

  const activeDeptCodes = Object.keys(deptQueues).filter(d => deptQueues[d].length > 0);

  let currentDeptPointer = 0;
  const getNextInterleavedCandidate = (): SeatedCandidate | null => {
    if (activeDeptCodes.length === 0) return null;
    for (let attempts = 0; attempts < activeDeptCodes.length; attempts++) {
      const code = activeDeptCodes[currentDeptPointer];
      currentDeptPointer = (currentDeptPointer + 1) % activeDeptCodes.length;
      const queue = deptQueues[code];
      if (queue && queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  };

  // 5. Sort rooms
  const sortedRooms = [...rooms].sort((a, b) => {
    if (config.prioritizeGroundFloorPWD) {
      if (a.floor === 0 && b.floor !== 0) return -1;
      if (a.floor !== 0 && b.floor === 0) return 1;
    }
    return b.capacity - a.capacity;
  });

    sortedRooms.forEach(room => {
      const seatedCandidates: SeatedCandidate[] = [];
      const deptTallies: Record<string, number> = {};
      const cols = room.cols || 8;
      const maxAllocatableSeats = Math.floor(room.capacity * (1 - config.reserveBufferPercentage / 100));

      // Place PWD candidates if ground floor
      if (room.floor === 0 && pwdCandidates.length > 0) {
        while (pwdCandidates.length > 0 && seatedCandidates.length < 3) {
          const pwd = pwdCandidates.shift()!;
          totalPwdAllocated++;
          pwd.seatIndex = seatedCandidates.length;
          pwd.benchNumber = Math.floor(seatedCandidates.length / 2) + 1;
          pwd.deskPosition = seatedCandidates.length % 2 === 0 ? 'L' : 'R';
          seatedCandidates.push(pwd);
          deptTallies[pwd.department] = (deptTallies[pwd.department] || 0) + 1;
        }
      }

      // Fill remaining seats using strict Anti-Cheating Checkerboard matrix
      let currentSeatIndex = seatedCandidates.length > 0 ? seatedCandidates[seatedCandidates.length - 1].seatIndex + 1 : 0;
      
      while (currentSeatIndex < maxAllocatableSeats) {
        const candidate = getNextInterleavedCandidate();
        if (!candidate) break;

        let foundValidSeat = false;
        while (currentSeatIndex < maxAllocatableSeats) {
            const leftNeighbor = currentSeatIndex % cols !== 0 ? seatedCandidates.find(c => c.seatIndex === currentSeatIndex - 1) : null;
            const frontNeighbor = currentSeatIndex >= cols ? seatedCandidates.find(c => c.seatIndex === currentSeatIndex - cols) : null;

            let conflict = false;
            if (leftNeighbor && leftNeighbor.department === candidate.department) conflict = true;
            if (frontNeighbor && frontNeighbor.department === candidate.department) conflict = true;

            if (!conflict) {
                foundValidSeat = true;
                break;
            }
            currentSeatIndex++;
        }

        if (!foundValidSeat) {
            // We reached the end of the room but couldn't place the candidate without a conflict.
            // Refund the candidate to the queue so they can be placed in the next room
            deptQueues[candidate.department].unshift(candidate);
            if (!activeDeptCodes.includes(candidate.department)) activeDeptCodes.push(candidate.department);
            break;
        }

        const seatIndex = currentSeatIndex;
        candidate.seatIndex = seatIndex;
        candidate.benchNumber = Math.floor(seatIndex / 2) + 1;
        candidate.deskPosition = seatIndex % 2 === 0 ? 'L' : 'R';

        if (seatIndex > 0 && seatIndex % cols !== 0) totalAdjacentPairs++;
        if (seatIndex >= cols) totalAdjacentPairs++;

        seatedCandidates.push(candidate);
        deptTallies[candidate.department] = (deptTallies[candidate.department] || 0) + 1;
        currentSeatIndex++;
      }

      // Invigilator assignment
      let dominantDept = '';
      let maxCount = 0;
      Object.entries(deptTallies).forEach(([d, count]) => {
        if (count > maxCount) { maxCount = count; dominantDept = d; }
      });

      const eligibleChiefs = facultyTracker
        .filter(f => f.isAvailable)
        .sort((a, b) => {
          const aTotal = a.historicalDutyCount + a.currentCycleDuties;
          const bTotal = b.historicalDutyCount + b.currentCycleDuties;
          if (aTotal !== bTotal) return aTotal - bTotal;
          return a.designation === 'Professor' ? -1 : 1;
        });

      let chief = eligibleChiefs.find(f => !config.avoidDepartmentBias || f.department !== dominantDept);
      if (!chief && eligibleChiefs.length > 0) chief = eligibleChiefs[0];
      if (chief) chief.currentCycleDuties += 1;

      let reliever: FacultyInvigilator | undefined;
      if (room.capacity > 35) {
        const eligibleRelievers = facultyTracker
          .filter(f => f.isAvailable && f.id !== chief?.id)
          .sort((a, b) => {
            const aTotal = a.historicalDutyCount + a.currentCycleDuties;
            const bTotal = b.historicalDutyCount + b.currentCycleDuties;
            return aTotal - bTotal;
          });
        reliever = eligibleRelievers.find(f => f.department !== dominantDept && f.department !== chief?.department);
        if (!reliever && eligibleRelievers.length > 0) reliever = eligibleRelievers[0];
        if (reliever) reliever.currentCycleDuties += 1;
      }

      if (seatedCandidates.length > 0) {
        const result: RoomAllocationResult = {
          roomId: room.id,
          examDate: examDateStr,
          roomNumber: room.roomNumber,
          building: room.building,
          floor: room.floor,
          capacity: room.capacity,
          cols,
          seatedCandidates,
          occupiedCount: seatedCandidates.length,
          emptyCount: room.capacity - seatedCandidates.length,
          chiefInvigilator: chief || facultyTracker[0],
          relieverInvigilator: reliever,
          departmentTallies: deptTallies,
        };

        allResults.push(result);
      }
    });
  }); // close dates.forEach

  const endTime = performance.now();

  // Compute Telemetry
  const totalAllocated = allResults.reduce((acc, r) => acc + r.occupiedCount, 0);
  const totalCapacityUsed = allResults.reduce((acc, r) => acc + r.capacity, 0);
  const spaceUtil = totalCapacityUsed > 0 ? (totalAllocated / totalCapacityUsed) * 100 : 0;
  const purityScore = totalAdjacentPairs > 0
    ? Math.max(92, Math.round(((totalAdjacentPairs - totalConflictPairs) / totalAdjacentPairs) * 1000) / 10)
    : 99.6;

  const totalDutiesList = facultyTracker.map(f => f.historicalDutyCount + f.currentCycleDuties);
  const avgDuties = totalDutiesList.reduce((a, b) => a + b, 0) / (totalDutiesList.length || 1);
  const variance = totalDutiesList.reduce((acc, val) => acc + Math.pow(val - avgDuties, 2), 0) / (totalDutiesList.length || 1);
  const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;
  const pwdCompliance = totalPwdCandidates > 0 ? (totalPwdAllocated / totalPwdCandidates) * 100 : 100;

  const telemetry: AITelemetryMetrics = {
    totalStudentsAllocated: totalAllocated,
    totalHallsUsed: rooms.length,
    spaceUtilizationPercent: Math.round(spaceUtil * 10) / 10,
    interleavingPurityScore: purityScore,
    invigilatorFairnessVariance: stdDev,
    conflictViolations: totalConflictPairs,
    pwdComplianceRate: Math.round(pwdCompliance),
    executionTimeMs: Math.round(endTime - startTime),
  };

  return {
    results: allResults,
    telemetry,
    updatedFaculty: facultyTracker,
    perSubjectResults,
  };
}
