/** The Elections tab, election hero, results, representatives, and the process guide. */
import type { Catalog } from "./types";

export const electionStrings = {
  "Show polls": { en: "Show polls", es: "Mostrar encuestas", zh: "显示民调" },
  "Polls are hidden until you choose to show them.": {
    en: "Polls are hidden until you choose to show them.",
    es: "Las encuestas se ocultan hasta que elijas verlas.",
    zh: "民调默认隐藏，选择后才会显示。",
  },
  "Checking polls…": {
    en: "Checking polls…",
    es: "Consultando encuestas…",
    zh: "正在查询民调…",
  },
  "Polling unavailable": {
    en: "Polling unavailable",
    es: "Encuestas no disponibles",
    zh: "无法获取民调",
  },
  "{rank} of {total}": {
    en: "{rank} of {total}",
    es: "{rank} de {total}",
    zh: "第 {rank} 名，共 {total} 名",
  },
  Candidates: { en: "Candidates", es: "Candidatos", zh: "候选人" },
  Governor: { en: "Governor", es: "Gobernador", zh: "州长" },
  "Governor poll": {
    en: "Governor poll",
    es: "Encuesta de gobernador",
    zh: "州长民调",
  },
  "Official statements {count}": {
    en: "Official statements {count}",
    es: "Declaraciones oficiales {count}",
    zh: "官方声明 {count}",
  },
  "No poll available in our sources": {
    en: "No poll available in our sources",
    es: "No hay encuestas disponibles en nuestras fuentes",
    zh: "我们的来源暂无相关民调",
  },
  "Reported results": {
    en: "Reported results",
    es: "Resultados reportados",
    zh: "已报告结果",
  },
  Poll: { en: "Poll", es: "Encuesta", zh: "民调" },
  Close: { en: "Close", es: "Cerrar", zh: "关闭" },
  "Expand poll": {
    en: "Expand poll",
    es: "Ver encuesta",
    zh: "展开民调",
  },
  "Collapse poll": {
    en: "Collapse poll",
    es: "Ocultar encuesta",
    zh: "收起民调",
  },
  "Yes/No only": {
    en: "Yes/No only",
    es: "Solo Sí/No",
    zh: "仅含赞成／反对",
  },
  "Poll details": {
    en: "Poll details",
    es: "Detalles de la encuesta",
    zh: "民调详情",
  },
  "in this poll": {
    en: "in this poll",
    es: "en esta encuesta",
    zh: "在本次民调中",
  },
  Undecided: { en: "Undecided", es: "Indecisos", zh: "未决定" },
  Neither: { en: "Neither", es: "Ninguno", zh: "均不支持" },
  "Equal in this poll": {
    en: "Equal in this poll",
    es: "Iguales en esta encuesta",
    zh: "本次民调支持率相同",
  },
  "{name} ahead by {points} points in this poll": {
    en: "{name} ahead by {points} points in this poll",
    es: "{name} lleva {points} puntos de ventaja en esta encuesta",
    zh: "{name} 在本次民调中领先 {points} 个百分点",
  },
  "Not reported": { en: "Not reported", es: "No reportado", zh: "未报告" },
  Publisher: { en: "Publisher", es: "Editor", zh: "发布机构" },
  Pollster: { en: "Pollster", es: "Encuestadora", zh: "民调机构" },
  Sponsor: { en: "Sponsor", es: "Patrocinador", zh: "赞助方" },
  "Field dates": {
    en: "Field dates",
    es: "Fechas de entrevistas",
    zh: "调查日期",
  },
  Published: { en: "Published", es: "Publicación", zh: "发布日期" },
  Population: { en: "Population", es: "Población", zh: "调查对象" },
  "California statewide likely voters": {
    en: "California statewide likely voters",
    es: "Probables votantes de todo California",
    zh: "加州全州可能投票者",
  },
  "Question sample": {
    en: "Question sample",
    es: "Muestra de esta pregunta",
    zh: "本题样本数",
  },
  "Survey likely voters": {
    en: "Survey likely voters",
    es: "Probables votantes de la encuesta",
    zh: "调查中的可能投票者样本数",
  },
  "Survey margin of error": {
    en: "Survey margin of error",
    es: "Margen de error de la encuesta",
    zh: "调查误差范围",
  },
  "percentage points": {
    en: "percentage points",
    es: "puntos porcentuales",
    zh: "个百分点",
  },
  "Margin of error scope": {
    en: "Margin of error scope",
    es: "Alcance del margen de error",
    zh: "误差范围适用对象",
  },
  Method: { en: "Method", es: "Método", zh: "调查方法" },
  Question: { en: "Question", es: "Pregunta", zh: "题号" },
  "A poll measures opinions. It is not counted votes.": {
    en: "A poll measures opinions. It is not counted votes.",
    es: "Una encuesta mide opiniones. No son votos contados.",
    zh: "民调反映意见，并非已统计的选票。",
  },
  "Published percentages may total 99% or 101% because of rounding. Bars use the published values.":
    {
      en: "Published percentages may total 99% or 101% because of rounding. Bars use the published values.",
      es: "Los porcentajes publicados pueden sumar 99% o 101% por redondeo. Las barras usan los valores publicados.",
      zh: "由于四舍五入，公布的百分比合计可能为 99% 或 101%。条形图使用公布数值。",
    },
  "Read the poll source": {
    en: "Read the poll source",
    es: "Leer la fuente de la encuesta",
    zh: "阅读民调来源",
  },
  "Results pending": {
    en: "Results pending",
    es: "Resultados pendientes",
    zh: "结果待公布",
  },
  "Checking results…": {
    en: "Checking results…",
    es: "Consultando resultados…",
    zh: "正在查询结果…",
  },
  "Results unavailable": {
    en: "Results unavailable",
    es: "Resultados no disponibles",
    zh: "结果暂不可用",
  },
  "No votes counted yet": {
    en: "No votes counted yet",
    es: "Aún no se han contado votos",
    zh: "尚未计票",
  },
  "Yes is ahead": {
    en: "Yes is ahead",
    es: "El sí va adelante",
    zh: "赞成票领先",
  },
  "No is ahead": {
    en: "No is ahead",
    es: "El no va adelante",
    zh: "反对票领先",
  },
  Tied: { en: "Tied", es: "Empate", zh: "平票" },
  Leading: { en: "Leading", es: "En cabeza", zh: "领先" },
  "{count} votes": {
    en: "{count} votes",
    es: "{count} votos",
    zh: "{count} 票",
  },
  "Official election results": {
    en: "Official election results",
    es: "Resultados electorales oficiales",
    zh: "官方选举结果",
  },

  // Election types and explainers
  "elections.type.primary": { en: "Primary", es: "Primaria", zh: "初选" },
  "elections.type.general": { en: "General", es: "General", zh: "普选" },
  "elections.type.special": { en: "Special", es: "Especial", zh: "特别选举" },
  "elections.type.recall": { en: "Recall", es: "Revocatoria", zh: "罢免" },
  "elections.type.runoff": {
    en: "Runoff",
    es: "Segunda vuelta",
    zh: "决选",
  },
  "elections.type.other": { en: "Election", es: "Elección", zh: "选举" },
  "elections.explainer.primary": {
    en: "A primary narrows the field. In California's top-two system, the two highest vote-getters for each office advance to the November general — regardless of party.",
    es: "Una primaria reduce la lista de candidatos. En el sistema de los dos primeros de California, los dos candidatos más votados para cada cargo pasan a la elección general de noviembre, sin importar el partido.",
    zh: "初选会缩小候选人范围。在加州的“前两名”制度下，每个职位得票最多的两名候选人进入 11 月的普选，无论党派。",
  },
  "elections.explainer.general": {
    en: "The general election decides who takes office. Winners are seated and approved measures become law.",
    es: "La elección general decide quién asume el cargo. Los ganadores toman posesión y las medidas aprobadas se convierten en ley.",
    zh: "普选决定由谁就任。胜选者就职，获得通过的提案成为法律。",
  },
  "elections.explainer.special": {
    en: "A special election is held off the normal cycle to fill a vacancy or settle a single urgent question.",
    es: "Una elección especial se celebra fuera del ciclo habitual para cubrir una vacante o resolver una sola cuestión urgente.",
    zh: "特别选举在常规周期之外举行，用于填补空缺或解决某个紧急问题。",
  },
  "elections.explainer.recall": {
    en: "A recall lets voters decide whether to remove an official from office before their term ends.",
    es: "Una revocatoria permite a los votantes decidir si destituyen a un funcionario antes de que termine su mandato.",
    zh: "罢免选举让选民决定是否在官员任期结束前将其免职。",
  },
  "elections.explainer.runoff": {
    en: "A runoff is a second round between the top finishers when no candidate won outright in the first round.",
    es: "Una segunda vuelta enfrenta a los candidatos más votados cuando nadie ganó directamente en la primera ronda.",
    zh: "当第一轮没有候选人直接胜出时，得票领先者将进行第二轮决选。",
  },
  "elections.explainer.other": {
    en: "Review the contests and measures below to see everything on your ballot.",
    es: "Revisa las contiendas y medidas a continuación para ver todo lo que hay en tu boleta.",
    zh: "查看下方的竞选和提案，了解你选票上的全部内容。",
  },
  "elections.explainer.primaryGeneric": {
    en: "Voters choose candidates for the next stage of the election. Rules vary by state and office.",
    es: "Los votantes eligen candidatos para la siguiente etapa de la elección. Las reglas varían según el estado y el cargo.",
    zh: "选民为选举的下一阶段选择候选人。规则因州和职位而异。",
  },

  // Contest grouping and fallbacks
  "elections.level.federal": { en: "Federal", es: "Federal", zh: "联邦" },
  "elections.level.state": { en: "State", es: "Estatal", zh: "州" },
  "elections.level.county": { en: "County", es: "Condado", zh: "县" },
  "elections.level.local": {
    en: "Local / Judicial",
    es: "Local / Judicial",
    zh: "地方 / 司法",
  },
  "elections.contestFallback": { en: "Contest", es: "Contienda", zh: "竞选" },
  "elections.mailBallot": {
    en: "Mail ballot",
    es: "Boleta por correo",
    zh: "邮寄选票",
  },
  "elections.electionDay": {
    en: "Election Day",
    es: "Día de la Elección",
    zh: "选举日",
  },

  // Elections tab entry
  "elections.tabTitle": { en: "Elections", es: "Elecciones", zh: "选举" },
  "elections.yourBallot": {
    en: "Your Ballot",
    es: "Tu boleta",
    zh: "你的选票",
  },
  "elections.entry.kickerGeneral": {
    en: "{date} · GENERAL ELECTION",
    es: "{date} · ELECCIÓN GENERAL",
    zh: "{date} · 普选",
  },
  "elections.entry.kickerGuide": {
    en: "CALIFORNIA STATEWIDE GUIDE",
    es: "GUÍA ESTATAL DE CALIFORNIA",
    zh: "加州全州选民指南",
  },
  "elections.entry.title": {
    en: "Voting in California?",
    es: "¿Votas en California?",
    zh: "在加州投票？",
  },
  "elections.entry.guideTitle": {
    en: "The statewide guide",
    es: "La guía estatal",
    zh: "全州指南",
  },
  "elections.entry.guideBody": {
    en: "Read official candidate statements and statewide propositions.",
    es: "Lee las declaraciones oficiales de los candidatos y las propuestas estatales.",
    zh: "阅读官方候选人声明和全州提案。",
  },
  "elections.entry.guideNote": {
    en: "Statewide information, not your personal ballot.",
    es: "Información estatal, no tu boleta personal.",
    zh: "这是全州信息，不是你的个人选票。",
  },
  "elections.entry.loading": {
    en: "Loading statewide preview…",
    es: "Cargando la vista previa estatal…",
    zh: "正在加载全州预览…",
  },
  "elections.entry.explore": {
    en: "Explore the guide",
    es: "Explorar la guía",
    zh: "浏览指南",
  },
  "elections.entry.exploreA11y": {
    en: "Explore the California statewide guide",
    es: "Explorar la guía estatal de California",
    zh: "浏览加州全州指南",
  },
  "elections.entry.officialGuide": {
    en: "Read California’s official guide",
    es: "Leer la guía oficial de California (en inglés)",
    zh: "阅读加州官方指南（英文）",
  },
  "elections.entry.research": {
    en: "Candidate research",
    es: "Investigación de candidatos",
    zh: "候选人研究",
  },
  "elections.entry.researchA11y": {
    en: "Explore candidate research",
    es: "Explorar la investigación de candidatos",
    zh: "浏览候选人研究",
  },
  "elections.entry.researchNote": {
    en: "Records, promises and reported funding.",
    es: "Historial, promesas y financiamiento declarado.",
    zh: "履历、承诺和申报的资金。",
  },
  "elections.entry.process": {
    en: "How elections work",
    es: "Cómo funcionan las elecciones",
    zh: "选举如何运作",
  },
  "elections.entry.processA11y": {
    en: "Learn how elections work",
    es: "Aprender cómo funcionan las elecciones",
    zh: "了解选举如何运作",
  },
  "elections.entry.processNote": {
    en: "Primaries, nominations and your vote.",
    es: "Primarias, nominaciones y tu voto.",
    zh: "初选、提名和你的选票。",
  },
  "elections.entry.localNote": {
    en: "View upcoming and recent city decisions.",
    es: "Consulta las decisiones municipales próximas y recientes.",
    zh: "查看即将审议和近期的市政决策。",
  },
  "elections.entry.notes": {
    en: "Your saved notes",
    es: "Tus notas guardadas",
    zh: "你保存的笔记",
  },
  "elections.entry.notesNote": {
    en: "Private reading notes on this device.",
    es: "Notas de lectura privadas en este dispositivo.",
    zh: "保存在此设备上的私人阅读笔记。",
  },
  "elections.entry.lookup": {
    en: "Find my official ballot",
    es: "Buscar mi boleta oficial",
    zh: "查找我的官方选票",
  },
  "elections.entry.lookupA11y": {
    en: "Find my official ballot through my election office",
    es: "Buscar mi boleta oficial a través de mi oficina electoral",
    zh: "通过我的选举办公室查找我的官方选票",
  },
  "elections.entry.lookupNote": {
    en: "Through your election office.",
    es: "A través de tu oficina electoral.",
    zh: "通过你的选举办公室。",
  },

  // Address-based ballot (Elections tab)
  "elections.devScenarios": {
    en: "Development · synthetic ballot scenarios",
    es: "Desarrollo · escenarios de boleta sintéticos",
    zh: "开发 · 合成选票场景",
  },
  "elections.votingAddress": {
    en: "VOTING ADDRESS",
    es: "DIRECCIÓN DE VOTACIÓN",
    zh: "投票地址",
  },
  "elections.editAddressA11y": {
    en: "Edit registered address",
    es: "Editar la dirección registrada",
    zh: "编辑登记地址",
  },
  "elections.enterAddress": {
    en: "Enter your registered address above to load the election and ballot for where you vote.",
    es: "Ingresa arriba tu dirección registrada para cargar la elección y la boleta del lugar donde votas.",
    zh: "在上方输入你的登记地址，以加载你投票所在地的选举和选票。",
  },
  "elections.mismatch": {
    en: "The provider returned a different election. Choose another election or retry to load the ballot you selected.",
    es: "El proveedor devolvió otra elección. Elige otra elección o vuelve a intentarlo para cargar la boleta que seleccionaste.",
    zh: "数据提供方返回了另一场选举。请选择其他选举，或重试加载你选择的选票。",
  },
  "elections.retrySelected": {
    en: "Retry selected ballot",
    es: "Reintentar la boleta seleccionada",
    zh: "重试所选选票",
  },
  "elections.unsupportedState": {
    en: "We only cover California elections right now. Support for your state is coming soon.",
    es: "Por ahora solo cubrimos las elecciones de California. Pronto habrá información para tu estado.",
    zh: "我们目前只覆盖加州选举。你所在州的支持即将推出。",
  },
  "elections.scope.statewideOnly": {
    en: "Statewide contests only. Local races and measures may be missing.",
    es: "Solo contiendas estatales. Pueden faltar contiendas y medidas locales.",
    zh: "仅含全州竞选。可能缺少地方竞选和提案。",
  },
  "elections.scope.unknown": {
    en: "Address coverage unconfirmed. These contests may not match your address.",
    es: "Cobertura de la dirección sin confirmar. Es posible que estas contiendas no correspondan a tu dirección.",
    zh: "地址覆盖范围未确认。这些竞选可能与你的地址不符。",
  },
  "elections.scope.incomplete": {
    en: "Coverage may be incomplete.",
    es: "La cobertura puede estar incompleta.",
    zh: "覆盖范围可能不完整。",
  },
  "elections.syntheticFixture": {
    en: "Synthetic development fixture",
    es: "Datos sintéticos de desarrollo",
    zh: "合成开发数据",
  },
  "elections.candidatesTab": {
    en: "Candidates {count}",
    es: "Candidatos {count}",
    zh: "候选人 {count}",
  },
  "elections.measuresTab": {
    en: "Measures {count}",
    es: "Medidas {count}",
    zh: "提案 {count}",
  },
  "elections.noCandidateContests": {
    en: "No candidate contests on this ballot.",
    es: "No hay contiendas de candidatos en esta boleta.",
    zh: "此选票上没有候选人竞选。",
  },
  "elections.ballotMeasures": {
    en: "Ballot measures",
    es: "Medidas electorales",
    zh: "选票提案",
  },
  "elections.noMeasures": {
    en: "No measures supplied for this ballot.",
    es: "No se proporcionaron medidas para esta boleta.",
    zh: "此选票未提供任何提案。",
  },
  "elections.noContests": {
    en: "Contest information is unavailable for this address. Check your election office for the official ballot.",
    es: "No hay información de contiendas para esta dirección. Consulta a tu oficina electoral para ver la boleta oficial.",
    zh: "此地址暂无竞选信息。请向你的选举办公室查询官方选票。",
  },
  "elections.officialSource": {
    en: "Official · {source}",
    es: "Oficial · {source}",
    zh: "官方 · {source}",
  },
  "elections.aiSummary": {
    en: "AI-generated summary",
    es: "Resumen generado por IA",
    zh: "AI 生成的摘要",
  },
  "elections.fiscalImpact": {
    en: "Fiscal impact",
    es: "Impacto fiscal",
    zh: "财政影响",
  },
  "elections.supportersArgue": {
    en: "Supporters argue",
    es: "Los partidarios argumentan",
    zh: "支持方认为",
  },
  "elections.opponentsArgue": {
    en: "Opponents argue",
    es: "Los opositores argumentan",
    zh: "反对方认为",
  },
  "elections.readFullMeasure": {
    en: "Read full measure",
    es: "Leer la medida completa",
    zh: "阅读完整提案",
  },

  // Banner, calendar, address cluster
  "elections.banner.days": {
    en: { one: "{count} day", other: "{count} days" },
    es: { one: "{count} día", other: "{count} días" },
    zh: "{count} 天",
  },
  "elections.banner.until": {
    en: "until {election}",
    es: "para {election}",
    zh: "后举行 {election}",
  },
  "elections.banner.sub": {
    en: "Know what's on your ballot",
    es: "Conoce lo que hay en tu boleta",
    zh: "了解你选票上的内容",
  },
  "elections.banner.cta": {
    en: "See My Ballot",
    es: "Ver mi boleta",
    zh: "查看我的选票",
  },
  "elections.keyDates.calendar": {
    en: "Calendar",
    es: "Calendario",
    zh: "日程",
  },
  "elections.keyDates.registerBy": {
    en: "Register by",
    es: "Inscríbete antes del",
    zh: "登记截止",
  },
  "elections.keyDates.earlyVoting": {
    en: "Early voting",
    es: "Votación anticipada",
    zh: "提前投票",
  },
  "elections.keyDates.passed": { en: "Passed", es: "Pasó", zh: "已过" },
  "elections.keyDates.days": {
    en: { one: "{count} day", other: "{count} days" },
    es: { one: "{count} día", other: "{count} días" },
    zh: "{count} 天",
  },
  "elections.myBallot.address": { en: "Address", es: "Dirección", zh: "地址" },
  "elections.myBallot.whereYouVote": {
    en: "Where you vote",
    es: "Dónde votas",
    zh: "你的投票地点",
  },
  "elections.myBallot.fullBallot": {
    en: "Full ballot",
    es: "Boleta completa",
    zh: "完整选票",
  },

  // Live results
  "elections.results.live": {
    en: "Live results",
    es: "Resultados en vivo",
    zh: "实时结果",
  },
  "elections.results.title": { en: "Results", es: "Resultados", zh: "结果" },
  "elections.results.badge.primary": {
    en: "CA Primary",
    es: "Primaria de CA",
    zh: "加州初选",
  },
  "elections.results.badge.general": {
    en: "CA General",
    es: "General de CA",
    zh: "加州普选",
  },
  "elections.results.badge.special": {
    en: "CA Special",
    es: "Especial de CA",
    zh: "加州特别选举",
  },
  "elections.results.badge.other": {
    en: "CA Election",
    es: "Elección de CA",
    zh: "加州选举",
  },
  "elections.results.statewide": {
    en: "Statewide",
    es: "Estatal",
    zh: "全州",
  },
  "elections.results.district": {
    en: "Your district races",
    es: "Contiendas de tu distrito",
    zh: "你所在选区的竞选",
  },
  "elections.results.attribution": {
    en: "Source: California Secretary of State",
    es: "Fuente: Secretaría de Estado de California",
    zh: "来源：加州州务卿",
  },
  "elections.results.incumbent": {
    en: "INCUMBENT",
    es: "EN EL CARGO",
    zh: "现任",
  },
  "elections.results.advances": {
    en: "Advances",
    es: "Avanza",
    zh: "晋级",
  },
  "elections.results.votes": {
    en: { one: "{count} vote", other: "{count} votes" },
    es: { one: "{count} voto", other: "{count} votos" },
    zh: "{count} 票",
  },
  "elections.results.districtTitle": {
    en: "{chamber} · District {district}",
    es: "{chamber} · Distrito {district}",
    zh: "{chamber} · 第 {district} 选区",
  },
  "elections.results.reporting": {
    en: "{percent}% reporting · as of {asOf}",
    es: "{percent}% escrutado · al {asOf}",
    zh: "已统计 {percent}% · 截至 {asOf}",
  },
  "elections.results.asOf": {
    en: "As of {asOf}",
    es: "Al {asOf}",
    zh: "截至 {asOf}",
  },
  "elections.results.moreCandidates": {
    en: { one: "+{count} more candidate", other: "+{count} more candidates" },
    es: { one: "+{count} candidato más", other: "+{count} candidatos más" },
    zh: "另有 {count} 名候选人",
  },
  "elections.results.viewOfficial": {
    en: "View official results",
    es: "Ver resultados oficiales",
    zh: "查看官方结果",
  },
  "elections.chamber.us-house": {
    en: "U.S. House",
    es: "Cámara de Representantes de EE. UU.",
    zh: "美国众议院",
  },
  "elections.chamber.state-senate": {
    en: "State Senate",
    es: "Senado estatal",
    zh: "州参议院",
  },
  "elections.chamber.state-assembly": {
    en: "State Assembly",
    es: "Asamblea estatal",
    zh: "州众议会",
  },

  // Representatives
  "elections.reps.title": {
    en: "Representatives",
    es: "Representantes",
    zh: "民意代表",
  },
  "elections.reps.error": {
    en: "Couldn't load officials for this address.",
    es: "No se pudieron cargar los funcionarios de esta dirección.",
    zh: "无法加载此地址的官员信息。",
  },
  "elections.reps.source": {
    en: "Current legislator data: Open States",
    es: "Datos actuales de legisladores: Open States",
    zh: "现任议员数据：Open States",
  },
  "elections.reps.call": { en: "Call", es: "Llamar", zh: "致电" },
  "elections.reps.email": { en: "Email", es: "Correo", zh: "邮件" },
  "elections.reps.website": { en: "Website", es: "Sitio web", zh: "网站" },
  "elections.reps.callA11y": {
    en: "Call {name}",
    es: "Llamar a {name}",
    zh: "致电 {name}",
  },
  "elections.reps.emailA11y": {
    en: "Email {name}",
    es: "Enviar un correo a {name}",
    zh: "给 {name} 发邮件",
  },
  "elections.reps.websiteA11y": {
    en: "Open {name}'s website",
    es: "Abrir el sitio web de {name}",
    zh: "打开 {name} 的网站",
  },
} satisfies Catalog;
