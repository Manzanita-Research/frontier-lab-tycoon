// Who you can hire (FLT-10). Data only: adding a job title is an entry here plus a behaviour in sim/staff.ts.
// Salaries are per game day. Parody names only.
import type { StaffJob } from "../sim/types";

export interface StaffDef {
  job: StaffJob;
  /** "Janitor Bot". */
  title: string;
  /** Per game day. */
  salary: number;
  blurb: string;
  /** What they do, as the Staff panel says it. */
  duty: string;
  /** Body colour in the scene and the panel swatch. */
  color: string;
  /** Tiles per tick: a walker does 0.12; an SRE jogs. */
  speed: number;
  /** How long one job takes once they are there, in ticks (a tick is 1.2 game hours), [min, max]. */
  work: [number, number];
  /** Names, picked in hiring order so a small team reads as a cast. Bots get a serial number too. */
  names: string[];
  /** Said when someone joins, and when someone is let go: `{name}` is theirs. */
  hired: string;
  fired: string;
}

export const STAFF: Record<StaffJob, StaffDef> = {
  janitor: {
    job: "janitor",
    title: "Janitor Bot",
    salary: 2_000,
    blurb: "Mops slop off the paths. Has seen things. Cannot un-see them.",
    duty: "Cleans slop",
    color: "#3fc7b4",
    speed: 0.13,
    work: [2, 3],
    names: ["MOP-{n} 'Sir Sloppington'", "MOP-{n} 'Squeegee'", "MOP-{n} 'Mopsy'", "MOP-{n} 'Drip'", "MOP-{n} 'Dustin'", "MOP-{n} 'Sudsy'", "MOP-{n} 'Bucky'", "MOP-{n} 'Gloria Scrubb'"],
    hired: "{name} clocked in. The slop has been notified.",
    fired: "{name} was let go. Left a mop and a note: 'you'll be back'.",
  },
  sre: {
    job: "sre",
    title: "SRE",
    salary: 4_000,
    blurb: "Runs toward the fire. The pager is a lifestyle.",
    duty: "Fixes broken buildings",
    color: "#ff8a2b",
    speed: 0.2,
    work: [2, 3],
    names: ["Sam 'Pager' Uptime", "Nines McFiveNines", "Ronnie Rollback", "Dana Downtime", "Priya Postmortem", "Kit Oncall", "Sol Rebooter", "Jo Hotfix"],
    hired: "{name} joined the rotation and immediately got paged.",
    fired: "{name} was let go. Their last commit: 'it works on my pager'.",
  },
  comms: {
    job: "comms",
    title: "Comms Rep",
    salary: 3_000,
    blurb: "Hands protesters a tote bag and a statement. Discourse -2 a day each while there are protesters.",
    duty: "Calms protesters",
    color: "#c77dff",
    speed: 0.15,
    work: [2, 4],
    names: ["Chelsea Spinwell", "Blake Talkingpoints", "Kim 'No Comment' Alvarez", "Devon Onmessage", "Rory Reassure", "Parker Statement", "Ash Holdingline", "Quinn Bridgebuilder"],
    hired: "{name} started. First statement: 'We hear you. We are listening. We are not changing anything.'",
    fired: "{name} was let go, and released a statement about it.",
  },
  security: {
    job: "security",
    title: "Security",
    salary: 3_000,
    blurb: "Walks the fence. Nothing has escaped. Officially.",
    duty: "Patrols the fence",
    color: "#3b5bdb",
    speed: 0.14,
    work: [2, 3],
    names: ["Big Gary (Not An Agent)", "Officer Firewall", "Sergeant Sandbox", "Deb from Perimeter", "Marco Lockdown", "Tess Checkpoint", "Old Pat, Night Shift", "Vic Badgeswipe"],
    hired: "{name} started the fence walk. Nothing has escaped. Yet.",
    fired: "{name} was let go. The fence has never felt so exposed.",
  },
};

export const STAFF_JOBS = Object.keys(STAFF) as StaffJob[];

/** The most people on the payroll at once (twelve of any one job): a lab runs out of desks before it runs out of ideas. */
export const MAX_STAFF = 40;
export const MAX_PER_JOB = 12;
