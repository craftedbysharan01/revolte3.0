/**
 * Solar icons (Revolte DS: "Solar Linear by default; swap to Bold on hover, active and selected").
 * Add an icon once here, then use <Icon name="..." bold? /> everywhere.
 */
import type { ComponentType } from 'react'
import {
  AddCircleIcon as AddCircleL, AddIcon as AddL, AltArrowDownIcon as DownL, AltArrowLeftIcon as LeftL, AltArrowRightIcon as RightL,
  AltArrowUpIcon as UpL, ArrowRightUpIcon as OutL, ArrowUpIcon as ArrowUpL, BellIcon as BellL, BoxIcon as BoxL, BugIcon as BugL, ChatRoundDotsIcon as ChatL,
  CheckCircleIcon as CheckCircleL, CheckIcon as CheckL, ClipboardListIcon as ClipboardL, ClockCircleIcon as ClockL, CloseCircleIcon as CloseCircleL,
  CloseIcon as CloseL, CodeIcon as CodeL, CopyIcon as CopyL, CpuIcon as CpuL, DangerCircleIcon as DangerL, DangerTriangleIcon as WarnL,
  DatabaseIcon as DatabaseL, DocumentTextIcon as DocL, DownloadMinimalisticIcon as DownloadL, FolderIcon as FolderL, FolderWithFilesIcon as FilesL,
  GitBranchIcon as BranchL, GlobeIcon as GlobeL, InboxIcon as InboxL, InfoCircleIcon as InfoL, KeyMinimalisticIcon as KeyL, LightbulbIcon as BulbL,
  LockIcon as LockL, MagnifierIcon as SearchL, MenuDotsIcon as DotsL, MonitorIcon as MonitorL, PauseIcon as PauseL, PaperclipIcon as ClipL,
  PenIcon as PenL, PenNewSquareIcon as NewChatL, PlayIcon as PlayL, PlugIcon as PlugL, RefreshIcon as RefreshL, ReplyIcon as ReplyL, RestartIcon as RestartL,
  RocketIcon as RocketL, RoutingIcon as RoutingL, ServerIcon as ServerL, ShareIcon as ShareL, ShieldCheckIcon as ShieldL, SidebarMinimalisticIcon as SidebarL,
  SmartphoneIcon as PhoneL, StarIcon as StarL, StarsIcon as StarsL, StopIcon as StopL, TuningIcon as TuneL, UploadMinimalisticIcon as UploadL, WidgetIcon as WidgetL,
  Widget2Icon as Widget2L, BotIcon as BotL, CodeFileIcon as CodeFileL, CodeSquareIcon as CodeSqL, ChecklistMinimalisticIcon as ChecklistL, TrashBinMinimalisticIcon as TrashL,
  StopwatchIcon as TimerL, ArchiveIcon as ArchiveL, LinkMinimalisticIcon as LinkL, PlayCircleIcon as PlayCircleL,
  UserRoundedIcon as userL2,
  UsersGroupRoundedIcon as usersL2,
  CardIcon as cardL2,
  SunIcon as sunL2,
  QuestionCircleIcon as questionL2,
  Logout2Icon as logoutL2,
  Buildings2Icon as buildingsL2,
  BoxMinimalisticIcon as boxMinL2,
  NotebookMinimalisticIcon as notebookL2,
  PlugCircleIcon as plugCircleL2,
  AtomIcon as atomL2,
  FolderOpenIcon as folderOpenL2,
  SortIcon as sortL2,
  RewindForwardIcon as forwardL3,
  TestTubeIcon as testTubeL3,
  SettingsIcon as settingsL3,
  SquareArrowRightUpIcon as squareOutL3,
} from '@solar-icons/react/linear'
import {
  AddCircleIcon as AddCircleB, AddIcon as AddB, AltArrowDownIcon as DownB, ArrowUpIcon as ArrowUpB, BoxIcon as BoxB, BugIcon as BugB, ChatRoundDotsIcon as ChatB,
  CheckCircleIcon as CheckCircleB, ClockCircleIcon as ClockB, CodeIcon as CodeB, CopyIcon as CopyB, CpuIcon as CpuB, DangerCircleIcon as DangerB, DocumentTextIcon as DocB,
  FolderIcon as FolderB, FolderWithFilesIcon as FilesB, GitBranchIcon as BranchB, InboxIcon as InboxB, KeyMinimalisticIcon as KeyB, LightbulbIcon as BulbB,
  MonitorIcon as MonitorB, PenNewSquareIcon as NewChatB, PlugIcon as PlugB, RocketIcon as RocketB, RoutingIcon as RoutingB, ServerIcon as ServerB,
  SidebarMinimalisticIcon as SidebarB, StarIcon as StarB, StopIcon as StopB, WidgetIcon as WidgetB, Widget2Icon as Widget2B, BotIcon as BotB, MagnifierIcon as SearchB,
  PauseIcon as PauseB, CheckCircleIcon as CheckB,
  UserRoundedIcon as userB2,
  UsersGroupRoundedIcon as usersB2,
  CardIcon as cardB2,
  SunIcon as sunB2,
  QuestionCircleIcon as questionB2,
  Logout2Icon as logoutB2,
  Buildings2Icon as buildingsB2,
  BoxMinimalisticIcon as boxMinB2,
  NotebookMinimalisticIcon as notebookB2,
  PlugCircleIcon as plugCircleB2,
  AtomIcon as atomB2,
  FolderOpenIcon as folderOpenB2,
  SortIcon as sortB2,
  RewindForwardIcon as forwardB3,
  TestTubeIcon as testTubeB3,
  SettingsIcon as settingsB3,
  SquareArrowRightUpIcon as squareOutB3,
  PaperclipIcon as clipB3,
  ChecklistMinimalisticIcon as checklistB3,
  ShieldCheckIcon as shieldB3,
  PlayIcon as playB3,
} from '@solar-icons/react/bold'

type Ic = ComponentType<{ size?: number | string; color?: string; className?: string }>

const L: Record<string, Ic> = {
  addCircle: AddCircleL, plus: AddL, down: DownL, left: LeftL, right: RightL, up: UpL, out: OutL, arrowUp: ArrowUpL, bell: BellL, box: BoxL, bug: BugL,
  chat: ChatL, checkCircle: CheckCircleL, check: CheckL, clipboard: ClipboardL, clock: ClockL, closeCircle: CloseCircleL, close: CloseL, code: CodeL, copy: CopyL,
  cpu: CpuL, danger: DangerL, warn: WarnL, database: DatabaseL, doc: DocL, download: DownloadL, folder: FolderL, files: FilesL, branch: BranchL, globe: GlobeL,
  inbox: InboxL, info: InfoL, key: KeyL, bulb: BulbL, lock: LockL, search: SearchL, dots: DotsL, monitor: MonitorL, pause: PauseL, clip: ClipL, pen: PenL,
  newChat: NewChatL, play: PlayL, plug: PlugL, refresh: RefreshL, reply: ReplyL, restart: RestartL, rocket: RocketL, routing: RoutingL, server: ServerL, share: ShareL,
  shield: ShieldL, sidebar: SidebarL, phone: PhoneL, star: StarL, stars: StarsL, stop: StopL, tune: TuneL, upload: UploadL, widget: WidgetL, widget2: Widget2L,
  cube2: BoxL,
  forward: forwardL3,
  testTube: testTubeL3,
  settings: settingsL3,
  squareOut: squareOutL3,
  user: userL2,
  users: usersL2,
  card: cardL2,
  sun: sunL2,
  question: questionL2,
  logout: logoutL2,
  buildings: buildingsL2,
  boxMin: boxMinL2,
  notebook: notebookL2,
  plugCircle: plugCircleL2,
  atom: atomL2,
  folderOpen: folderOpenL2,
  sort: sortL2,
  bot: BotL, codeFile: CodeFileL, codeSquare: CodeSqL, checklist: ChecklistL, trash: TrashL, timer: TimerL, archive: ArchiveL, link: LinkL, playCircle: PlayCircleL,
}
const B: Record<string, Ic> = {
  addCircle: AddCircleB, plus: AddB, down: DownB, arrowUp: ArrowUpB, box: BoxB, bug: BugB, chat: ChatB, checkCircle: CheckCircleB, clock: ClockB, code: CodeB,
  copy: CopyB, cpu: CpuB, danger: DangerB, doc: DocB, folder: FolderB, files: FilesB, branch: BranchB, inbox: InboxB, key: KeyB, bulb: BulbB, monitor: MonitorB,
  newChat: NewChatB, plug: PlugB, rocket: RocketB, routing: RoutingB, server: ServerB, sidebar: SidebarB, star: StarB, stop: StopB, widget: WidgetB, widget2: Widget2B,
  user: userB2, users: usersB2, card: cardB2, sun: sunB2, question: questionB2, logout: logoutB2, buildings: buildingsB2, boxMin: boxMinB2, notebook: notebookB2, plugCircle: plugCircleB2, atom: atomB2, folderOpen: folderOpenB2, sort: sortB2, 
  forward: forwardB3, testTube: testTubeB3, settings: settingsB3, squareOut: squareOutB3, clip: clipB3, checklist: checklistB3, shield: shieldB3, play: playB3,
  bot: BotB, search: SearchB, pause: PauseB, check: CheckB,
}

export type IconName = keyof typeof L

export function Icon({ name, size = 16, bold, className }: { name: IconName; size?: number; bold?: boolean; className?: string }) {
  const C = (bold && B[name]) || L[name]
  return <C size={size} className={className} />
}
