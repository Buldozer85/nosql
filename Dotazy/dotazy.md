# Sada netriviálních dotázů pro databázy

## Připojení přes terminál pro provádění dotazů
````bash
docker exec -it mongos-router mongosh -u admin -p <MONGO_ADMIN_PASSWORD> --authenticationDatabase admin nfl_db
````
## Analytické a agregační dotazy

### Dotaz 1 - Nejúspěšnější týmy ve hře vzduchem
Zadání v přirozeném jazyce: Zjisti 5 týmů, které získaly celkově nejvíce yardů pouze pomocí přihrávek (pass), a pomocí spojení s kolekcí týmů zobraz jejich oficiální plné názvy místo zkratek.

````javascript
db.plays.aggregate([
  { $match: { play_type: "pass", yards_gained: { $gt: 0 } } },
  { $group: { 
      _id: "$posteam", 
      total_pass_yards: { $sum: "$yards_gained" }, 
      play_count: { $sum: 1 } 
  } },
  { $lookup: { 
      from: "teams", 
      localField: "_id", 
      foreignField: "team_abbr", 
      as: "team_details" 
  } },
  { $unwind: "$team_details" },
  { $project: { 
      _id: 0, 
      team_full_name: "$team_details.team_name", 
      total_pass_yards: 1, 
      play_count: 1 
  } },
  { $sort: { total_pass_yards: -1 } },
  { $limit: 5 }
])
````

#### Vysvětlení
* Dotaz nejprve vyfiltruje úspěšné přihrávky (`$match`) a seskupí je podle útočícího týmu (`$group`). 
* Sečte získané yardy a počet akcí. 
* `$lookup`, zafunguje jako klasický SQL JOIN a propojí identifikátor týmu s kolekcí teams. 
*  `$unwind` rozbalí výsledné pole do objektu a `$project` zajistí, že ve finálním výstupu uvidíme uživatelsky přívětivý plný název týmu místo jeho interního kódu. 
* Nakonec se data seřadí sestupně a omezí na Top 5.

#### Výsledek
````javascript
[                                                                                                                                                                                                                                                                                                                      
  {                                                                                                                                                                                                                                                                                                                    
    total_pass_yards: 5667,                                                                                                                                                                                                                                                                                            
    play_count: 445,
    team_full_name: 'Los Angeles Rams'
  },
  {
    total_pass_yards: 5303,
    play_count: 416,
    team_full_name: 'New England Patriots'
  },
  {
    total_pass_yards: 4772,
    play_count: 424,
    team_full_name: 'San Francisco 49ers'
  },
  {
    total_pass_yards: 4771,
    play_count: 401,
    team_full_name: 'Dallas Cowboys'
  },
  {
    total_pass_yards: 4760,
    play_count: 370,
    team_full_name: 'Seattle Seahawks'
  }
]
````

### Dotaz 2 Detailní profil top 5 Quaterbacků soutěže
Najdi 3 hráče s největším počtem naházených touchdownů a připoj k nim celý název jejich týmu a konferenci z kolekce teams.
````javascript
db.player_stats.aggregate([
  { $sort: { passing_tds: -1 } },
  { $limit: 5 },
  { $lookup: { 
      from: "teams", 
      localField: "recent_team", 
      foreignField: "team_abbr", 
      as: "team_info" 
  } },
  { $unwind: "$team_info" },
  { $project: { 
      _id: 0, 
      player_name: "$player_display_name", 
      passing_tds: 1, 
      full_team_name: "$team_info.team_name", 
      conference: "$team_info.team_conf",
      fantasy_points: "$fantasy_points"    
  } }
])
````

#### Vysvětlení
* Tento netriviální dotaz demonstruje logiku relačního spojení v NoSQL. 
* Seřadí hráče podle touchdownů, vybere první 3, a pomocí `$lookup` si "sáhne" do kolekce teams, kde spáruje zkratku týmu. 
* Příkaz `$unwind` rozbalí výsledné pole do objektu a $project nakonec vizuálně "učese" výstup, aby obsahoval jen požadované sloupce a skryl zbytečnosti.

#### Výsledek
````javascript
[
  {
    passing_tds: 52,
    player_name: 'Matthew Stafford',
    full_team_name: 'Los Angeles Rams',
    conference: 'NFC',
    fantasy_points: 411.32
  },
  {
    passing_tds: 37,
    player_name: 'Drake Maye',
    full_team_name: 'New England Patriots',
    conference: 'AFC',
    fantasy_points: 415.88
  },
  {
    passing_tds: 34,
    player_name: 'Jared Goff',
    full_team_name: 'Detroit Lions',
    conference: 'NFC',
    fantasy_points: 297.06
  },
  {
    passing_tds: 32,
    player_name: 'Trevor Lawrence',
    full_team_name: 'Jacksonville Jaguars',
    conference: 'AFC',
    fantasy_points: 357.56
  },
  {
    passing_tds: 31,
    player_name: 'Caleb Williams',
    full_team_name: 'Chicago Bears',
    conference: 'NFC',
    fantasy_points: 354.9
  }
]
````

### Dotaz 3 Fyzické parametry moderních hráčů podle pozic
Zjisti průměrnou váhu a výšku hráčů pro jednotlivé herní pozice u moderních hráčů (draftovaných od roku 2020). Výsledky převeď z imperiálních jednotek (libry a palce) do metrické soustavy (kilogramy a centimetry) a zaokrouhli na jedno desetinné místo. Zobraz jen pozice s více než 10 hráči.
````javascript
db.rosters.aggregate([
  { $match: { entry_year: { $gte: 2020 } } },
  { $group: { 
      _id: "$position", 
      total_players: { $sum: 1 }, 
      avg_weight_lbs: { $avg: "$weight" },
      avg_height_in: { $avg: "$height" }
  } },
  { $match: { total_players: { $gt: 10 } } },
  { $project: { 
      total_players: 1,
      avg_weight_kg: { 
          $round: [ { $multiply: ["$avg_weight_lbs", 0.453592] }, 1 ] 
      },
      avg_height_cm: { 
          $round: [ { $multiply: ["$avg_height_in", 2.54] }, 1 ] 
      }
  } },
  { $sort: { avg_weight_kg: -1 } }
])
````

#### Vysvětlení
* Tento dotaz demonstruje schopnost MongoDB provádět komplexní matematické transformace dat. 
* Nejdříve pomocí filtru `$match` omezíme data na hráče draftované po roce 2019. 
* Ve fázi `$group` vypočítáme průměrnou váhu a výšku pro každou herní pozici (což jsou data původně v librách a palcích). 
* V kroku `$project` tyto mezivýsledky za pomoci matematického operátoru `$multiply` znásobíme převodními koeficienty (0,453592 pro kg a 2,54 pro cm). 
* Nakonec pomocí `$round` výsledky vizuálně uhladíme na jedno desetinné místo a seřadíme sestupně podle váhy. 
* Tímto přístupem se vyhneme nutnosti přepočítávat data na straně aplikačního serveru.

#### Výsledek
````javascript
[                                                                                                                                                                                                                                                                                                                      
  {                                                                                                                                                                                                                                                                                                                    
    _id: 'OL',                                                                                                                                                                                                                                                                                                         
    total_players: 429,
    avg_weight_kg: 142.7,
    avg_height_cm: 195.5
  },
  {
    _id: 'DL',
    total_players: 341,
    avg_weight_kg: 131.3,
    avg_height_cm: 192
  },
  {
    _id: 'TE',
    total_players: 165,
    avg_weight_kg: 112.8,
    avg_height_cm: 195
  },
  {
    _id: 'LB',
    total_players: 327,
    avg_weight_kg: 108.7,
    avg_height_cm: 188.6
  },
  {
    _id: 'LS',
    total_players: 16,
    avg_weight_kg: 107.3,
    avg_height_cm: 188.6
  },
  {
    _id: 'QB',
    total_players: 81,
    avg_weight_kg: 98.6,
    avg_height_cm: 189.1
  },
  {
    _id: 'P',
    total_players: 19,
    avg_weight_kg: 96.6,
    avg_height_cm: 189.9
  },
  {
    _id: 'RB',
    total_players: 193,
    avg_weight_kg: 96.5,
    avg_height_cm: 179.6
  },
  {
    _id: 'WR',
    total_players: 321,
    avg_weight_kg: 89.2,
    avg_height_cm: 184.6
  },
  {
    _id: 'DB',
    total_players: 499,
    avg_weight_kg: 88.8,
    avg_height_cm: 183
  },
  {
    _id: 'K',
    total_players: 27,
    avg_weight_kg: 88.4,
    avg_height_cm: 183.9
  }
]
````

### Dotaz 4 - Zápasy v dómech s velkým počtem bodů
Najdi 5 zápasů hraných v uzavřených halách (dome), ve kterých padlo dohromady (domácí + hosté) nejvíce bodů. Místo zkratek týmů zobraz celá jména a stadion, na kterém se zápas odehrál
````javascript
db.games.aggregate([
  { $match: { roof: "dome" } },
  { $addFields: { 
      total_combined_score: { $add: ["$home_score", "$away_score"] } 
  } },
  { $lookup: {
      from: "teams",
      localField: "home_team",
      foreignField: "team_abbr",
      as: "home_info"
  } },
  { $unwind: "$home_info" },
  { $lookup: {
      from: "teams",
      localField: "away_team",
      foreignField: "team_abbr",
      as: "away_info"
  } },
  { $unwind: "$away_info" },
  { $sort: { total_combined_score: -1 } },
  { $limit: 5 },
  { $project: { 
      _id: 0,
      game_id: 1, 
      stadium: 1,
      home_team_name: "$home_info.team_name", 
      away_team_name: "$away_info.team_name", 
      home_score: 1,
      away_score: 1,
      total_combined_score: 1
  } }
])
````

#### Vysvětlení
* Tento pokročilý analytický dotaz kombinuje matematické operace s vícenásobným relačním spojováním (obdoba JOIN) v NoSQL prostředí. 
* Nejdříve pomocí filtru `$match` omezíme výběr pouze na zápasy konané v uzavřených halách (dome). 
* Následně pomocí `$addFields` a matematického operátoru `$add` vytvoříme za běhu nový virtuální sloupec s celkovým součtem bodů obou týmů. 
* Nahrazení zkratek týmu jejich názvy, provedou dva samostatné kroky `$lookup` (jeden pro domácí a druhý pro hostující stranu), které spárují zkratky s kolekcí teams. 
* Po rozbalení obou výsledků pomocí operátoru `$unwind` data seřadíme sestupně podle celkového skóre (`$sort`) a omezíme na Top 5 největších "přestřelek" (`$limit`).
* V závěrečné fázi `$project` dotaz vizuálně "učesáme" tak, aby vracel pouze vybraná data.

#### Výsledek
````javascript
[
  {
    game_id: '2025_15_DET_LA',
    home_score: 41,
    away_score: 34,
    stadium: 'SoFi Stadium',
    total_combined_score: 75,
    home_team_name: 'Los Angeles Rams',
    away_team_name: 'Detroit Lions'
  },
  {
    game_id: '2025_14_DAL_DET',
    home_score: 44,
    away_score: 30,
    stadium: 'Ford Field',
    total_combined_score: 74,
    home_team_name: 'Detroit Lions',
    away_team_name: 'Dallas Cowboys'
  },
  {
    game_id: '2025_02_CHI_DET',
    home_score: 52,
    away_score: 21,
    stadium: 'Ford Field',
    total_combined_score: 73,
    home_team_name: 'Detroit Lions',
    away_team_name: 'Chicago Bears'
  },
  {
    game_id: '2025_07_IND_LAC',
    home_score: 24,
    away_score: 38,
    stadium: 'SoFi Stadium',
    total_combined_score: 62,
    home_team_name: 'Los Angeles Chargers',
    away_team_name: 'Indianapolis Colts'
  },
  {
    game_id: '2025_12_NYG_DET',
    home_score: 34,
    away_score: 27,
    stadium: 'Ford Field',
    total_combined_score: 61,
    home_team_name: 'Detroit Lions',
    away_team_name: 'New York Giants'
  }
]
````

### Dotaz 5 Porovnání úspěšnost pass vs run play u 3. downů
Porovnej efektivitu mezi přihrávkou (pass) a během (run) při 3. downu. Zjisti nejen průměrný zisk yardů, ale především vypočítej procentuální úspěšnost konverze (zda akce získala dostatek yardů pro nový 1. down).
````javascript
db.plays.aggregate([
  { $match: { down: 3, play_type: { $in: ["run", "pass"] } } },
  { $addFields: { 
      is_converted: { 
          $cond: [ { $gte: ["$yards_gained", "$ydstogo"] }, 1, 0 ] 
      } 
  } },
  { $group: { 
      _id: "$play_type", 
      total_plays: { $sum: 1 }, 
      converted_plays: { $sum: "$is_converted" }, 
      avg_yards: { $avg: "$yards_gained" } 
  } },
  { $project: { 
      _id: 1, 
      total_plays: 1,
      converted_plays: 1,
      conversion_rate_percent: { 
          $round: [ 
              { $multiply: [ { $divide: ["$converted_plays", "$total_plays"] }, 100 ] }, 
              1 
          ] 
      },
      avg_yards: { $round: ["$avg_yards", 1] } 
  } },
    
  { $sort: { conversion_rate_percent: -1 } }
])
````

#### Vysvětlení
* Tento analytický dotaz modeluje reálnou sportovní analýzu úspěšnosti (tzv. Conversion Rate). 
* Po vyfiltrování krizových situací (3. down) využijeme ve fázi `$addFields` podmíněný operátor `$cond`. 
* Ten funguje jako if-else a vyhodnotí, zda získané yardy (yards_gained) byly větší nebo rovny yardům potřebným k zisku prvního downu (ydstogo). 
* Pokud ano, označí akci hodnotou 1. 
* Ve fázi `$group` tyto úspěšné konverze sečteme a v následném bloku `$project` provedeme komplexní matematický výpočet: podíl úspěšných akcí vůči všem akcím vynásobíme stem a zaokrouhlíme na jedno desetinné místo, čímž získáme přehlednou procentuální úspěšnost pro běhové i přihrávkové varianty.

#### Výsledek
````javascript
[                                                                                                                                                                                                                                                                                                                      
  {                                                                                                                                                                                                                                                                                                                    
    _id: 'run',                                                                                                                                                                                                                                                                                                        
    total_plays: 1906,
    converted_plays: 1043,
    conversion_rate_percent: 54.7,
    avg_yards: 4.5
  },
  {
    _id: 'pass',
    total_plays: 5254,
    converted_plays: 1823,
    conversion_rate_percent: 34.7,
    avg_yards: 5.6
  }
]
````

### Dotaz 6 Přínos "těžkotonážních" hráčů
Najdi hráče, kteří váží více než 250 liber, připoj k nim jejich statistiky a sečti, kolik "fantasy bodů" dohromady vyprodukovali hráči na daných pozicích.

````javascript
db.rosters.aggregate([
  { $match: { weight: { $gt: 250 } } },
  { $lookup: { 
      from: "player_stats", 
      localField: "gsis_id", 
      foreignField: "player_id", 
      as: "stats" 
  } },
  { $unwind: "$stats" },
  { $group: { 
      _id: "$position", 
      total_fantasy_points: { $sum: "$stats.fantasy_points" }, 
      heavy_players_count: { $sum: 1 } 
  } },
  { $sort: { total_fantasy_points: -1 } }
])
````

#### Vysvětlení
* Nejdříve hledáme těžké hráče v jedné kolekci. 
* Jelikož ale jejich výkonnost leží ve druhé kolekci, provedeme `$lookup`. 
* Pomocí `$unwind` z pole statistik vytvoříme klasické dokumenty. 
* Poté pomocí ($stats.fantasy_points) přistoupíme k napojeným datům, sečteme je dohromady a ukážeme, jaká pozice z těch těžkých hráčů je pro fantasy ligu nejcennější.

#### Výsledek
````javascript
[
    { _id: 'TE', total_fantasy_points: 1721.2, heavy_players_count: 62 },
    { _id: 'RB', total_fantasy_points: 289.8, heavy_players_count: 6 },
    { _id: 'DL', total_fantasy_points: 18.1, heavy_players_count: 298 },
    { _id: 'OL', total_fantasy_points: 15.9, heavy_players_count: 262 },
    { _id: 'LB', total_fantasy_points: 6, heavy_players_count: 60 },
    { _id: 'LS', total_fantasy_points: 0, heavy_players_count: 3 }
]
````

## Dotazy pro práci s daty

### Dotaz 7 Vytvoření sloupce a rozřazení hráčů podle years of experience
Aktualizuj soupisky všech hráčů (rosters). Za pomoci agregační roury jim dynamicky vypočítej a ulož nový sloupec years_of_experience (na základě aktuální sezóny 2025) a zároveň jim podle těchto let přiřaď textový štítek career_stage ("Rookie", "Pro" nebo "Veteran").

````javascript
db.rosters.updateMany(
  {}, // Update celé kolekce
  [
    { 
      $set: { 
        years_of_experience: { $subtract: [2025, "$entry_year"] } 
      } 
    },
    { 
      $set: { 
        career_stage: {
          $switch: {
            branches: [
              { case: { $eq: ["$years_of_experience", 0] }, then: "Rookie" },
              { case: { $lte: ["$years_of_experience", 3] }, then: "Pro" },
              { case: { $gt: ["$years_of_experience", 3] }, then: "Veteran" }
            ],
            default: "Unknown"
          }
        }
      } 
    }
  ]
)
````

#### Vysvětlení
* Tento dotaz překračuje běžné CRUD operace a demonstruje pokročilou funkci Pipeline Updates v MongoDB (použití agregační roury přímo v příkazu updateMany). 
* Nejdříve v prvním bloku `$set` využijeme matematický operátor `$subtract`, kterým dynamicky vypočítáme a uložíme novou vlastnost years_of_experience jako rozdíl aktuálního roku (2025) a roku vstupu hráče do ligy (entry_year). 
* Ihned v navazujícím bloku `$set` spouštíme logický operátor `$switch`, který na základě čerstvě vypočítaných zkušeností vyhodnotí do jaké kategorie hráč spadá (Rookie, Pro, Veteran) a výsledek uloží do pole career_stage.

### Dotaz 8 Přepočet metriky a výkonnostní štítkování (Multi-stage Update)
U všech Quarterbacků (QB) v kolekci player_stats, kteří odehráli alespoň 5 zápasů, vypočítej průměrný počet naházených yardů na zápas. Následně (ve stejném dotazu) využij tuto novou hodnotu k vytvoření výkonnostní třídy (performance_grade): hráči nad 250 yardů dostanou štítek "Elite", nad 200 "Starter", zbytek "Backup".
````javascript
db.player_stats.updateMany(
  { position: "QB", games: { $gte: 5 } },
  [
    { $set: { 
        passing_yards_per_game: { $round: [{ $divide: ["$passing_yards", "$games"] }, 1] } 
    } },
    { $set: {
        performance_grade: {
          $switch: {
            branches: [
              { case: { $gte: ["$passing_yards_per_game", 250] }, then: "Elite" },
              { case: { $gte: ["$passing_yards_per_game", 200] }, then: "Starter" }
            ],
            default: "Backup"
          }
        }
    } }
  ]
)
````

### Vysvětlení
* Tento dotaz je ukázkou komplexní aktualizace dat pomocí zřetězené agregační roury (Pipeline Update). 
* V prvním bloku `$set` databáze matematicky vypočítá (`$divide`, `$round`) průměrný zisk yardů na zápas. 
* Okamžitě v navazujícím druhém bloku `$set` databáze využije tuto čerstvě vytvořenou hodnotu (passing_yards_per_game) uvnitř operátoru `$switch`, aby hráče roztřídila do výkonnostních kategorií (Elite, Starter, Backup). 
* Tímto zřetězením jsme provedli dva logické kroky během jediného průchodu databází.

### Dotaz 9 Vytvoření All-Pro týmu
Pomocí složité agregace najdi absolutně nejlepšího hráče pro klíčové ofenzivní pozice (QB, WR, RB) na základě celkového součtu získaných yardů (během i vzduchem). Tuto vyfiltrovanou "elitu" pak hromadně vlož (insertMany) do nově vytvořené kolekce all_pro_roster.

````javascript
const top_players = db.player_stats.aggregate([
  { $match: { position: { $in: ["QB", "WR", "RB"] } } },
  { $addFields: { 
      total_offensive_yards: { $add: ["$passing_yards", "$rushing_yards", "$receiving_yards"] } 
  } },
  { $sort: { total_offensive_yards: -1 } },
  { $group: {
      _id: "$position",
      best_player: { $first: "$$ROOT" }
  } },
  { $replaceRoot: { newRoot: "$best_player" } },
  { $project: {
      _id: 0,
      player_display_name: 1,
      position: 1,
      recent_team: 1,
      total_offensive_yards: 1,
      award: "All-Pro 2025"
  } }
]).toArray();

db.all_pro_roster.insertMany(top_players);
````

#### Vysvětlení
* K vytvoření záznamů pro operaci insertMany databáze nejprve provede velmi složitou agregační rouru. 
* Pomocí `$addFields` sečte různé typy získaných yardů do jedné univerzální metriky, podle které data seřadí (`$sort`). 
* Krok `$group` a `$first`: "$$ROOT" zajistí, že si z každé herní pozice ponecháme pouze toho absolutně nejlepšího hráče (celý jeho dokument). 
* Pomocí `$replaceRoot` a `$project` dokumenty restrukturalizujeme, obohatíme o nový štítek "All-Pro 2025" a výsledek ve formě pole rovnou vložíme do nové kolekce.

### Dotaz 10 Vyřazení neaktivních hráčů
Najdi na soupiskách (rosters) všechny starší hráče (draftované před rokem 2024), kteří v sezóně 2025 nenastoupili do jediného zápasu (nemají záznam v player_stats). Získej jejich unikátní ID a následně je hromadně z kolekce soupisek vymaž (deleteMany).
````javascript
const cut_list = db.rosters.aggregate([
  { $lookup: { 
      from: "player_stats", 
      localField: "gsis_id", 
      foreignField: "player_id", 
      as: "stats" 
  } },
  { $match: { "stats": { $size: 0 }, entry_year: { $lt: 2024 } } },
  { $project: { _id: 1 } }
]).toArray().map(doc => doc._id);

db.rosters.deleteMany({ _id: { $in: cut_list } });
````

#### Vysvětlení
* Protože samotná operace deleteMany nepodporuje v MongoDB připojování cizích kolekcí (JOIN), je odstranění záznamů na základě chybějících dat v jiné kolekci velmi komplexní úlohou. 
* **Tento dotaz ji řeší ve dvou krocích:** 
* * První část využívá agregační rouru s operátory `$lookup` a `$match`, kde přes podmínku `$size: 0` vyfiltrujeme hráče z rosters, ke kterým neexistuje žádný záznam v player_stats. 
* * Pomocí JavaScriptové funkce `.map()` extrahujeme pouze jejich unikátní identifikátory. Tyto vytažené identifikátory pak předáme do podmínky `$in` uvnitř příkazu deleteMany, čímž dynamicky vyčistíme databázi od neaktivních hráčů.

### Dotaz 11 Generování "Výroční zprávy"
Vytvoř komplexní „Výroční zprávu“ o celé sezóně. Využij pokročilý agregační operátor `$facet` k tomu, abys v jednom jediném dotazu paralelně zpracoval 3 různé statistiky: Top 3 Quarterbacky (podle yardů), Top 3 Running backy (podle yardů) a celkový počet všech naházených touchdownů v lize. Výsledný masivní dokument obohať o časové razítko a vlož ho do nové kolekce season_reports

````javascript
const masivni_report = db.player_stats.aggregate([
  { 
    $facet: {
      "top_passers": [
        { $match: { position: "QB" } },
        { $sort: { passing_yards: -1 } },
        { $limit: 3 },
        { $project: { _id: 0, player_name: "$player_display_name", yards: "$passing_yards" } }
      ],
      "top_rushers": [
        { $match: { position: "RB" } },
        { $sort: { rushing_yards: -1 } },
        { $limit: 3 },
        { $project: { _id: 0, player_name: "$player_display_name", yards: "$rushing_yards" } }
      ],
      "league_totals": [
        { $group: { _id: null, total_passing_tds: { $sum: "$passing_tds" } } },
        { $project: { _id: 0 } }
      ]
    }
  },
  { $addFields: { generated_at: new Date(), season: 2025, report_type: "End of Year Summary" } }
]).toArray();
db.season_reports.insertOne(masivni_report[0]);
````
#### Vysvětlení
* Tento dotaz ukazuje, jak lze nahradit sérii samostatných databázových dotazů jedním vysoce optimalizovaným průchodem za pomoci operátoru `$facet`. 
* Databáze v rámci jednoho aggregate příkazu vytvoří tři paralelní, na sobě nezávislé roury (jedna filtruje Quarterbacky, druhá Running backy a třetí sčítá globální metriku přes `$group`). 
* Výsledkem fází uvnitř `$facet` jsou zanořená pole. Tento výstup následně pomocí `$addFields` obohatíme o systémové datum generování a ročník. 
* Protože výsledkem je komplexní NoSQL dokument plný zanořených polí a objektů, uložíme ho jako celek do auditní kolekce pomocí příkazu insertOne. 
* Tím je demonstrován pokročilý analytický vklad dat (Insert) bez nutnosti aplikační logiky na straně serveru.

### Dotaz 12 Souhrn sezóny týmů

Vytvoř komplexní agregovanou zprávu (Materialized View), která shrne ofenzivní sílu jednotlivých týmů. U každého týmu spočítej celkový počet ofenzivních akcí (běhů a přihrávek), celkový počet získaných yardů a průměrný zisk yardů na jednu akci. Nahraď zkratky týmů jejich plnými názvy, výsledky seřaď od nejlepších ofenziv a tento report trvale ulož do nové kolekce team_season_summary.

````javascript
db.plays.aggregate([
  { $match: { play_type: { $in: ["run", "pass"] }, yards_gained: { $gt: 0 } } },
  { $group: { 
      _id: "$posteam", 
      total_offensive_yards: { $sum: "$yards_gained" },
      total_plays: { $sum: 1 }
  } },
  { $addFields: {
      yards_per_play: { $round: [ { $divide: ["$total_offensive_yards", "$total_plays"] }, 1 ] }
  } },
  { $lookup: {
      from: "teams",
      localField: "_id",
      foreignField: "team_abbr",
      as: "team_info"
  } },
  { $unwind: "$team_info" },
  { $project: {
      _id: 0,
      team_abbr: "$_id",
      team_name: "$team_info.team_name",
      total_offensive_yards: 1,
      total_plays: 1,
      yards_per_play: 1
  } },
  { $sort: { total_offensive_yards: -1 } },
  { $merge: { 
      into: "team_season_summary", 
      whenMatched: "replace", 
      whenNotMatched: "insert" 
  } }
])
````

#### Vysvětlení
Tento vysoce pokročilý dotaz (skládající se z 8 zřetězených fází) demonstruje tvorbu tzv. materializovaného pohledu (Materialized View). 
* V první části agregační roury data vyfiltrujeme (`$match`) a seskupíme podle týmů (`$group`), čímž získáme základní součty. 
* Následně pomocí `$addFields` a matematické operace `$divide` dynamicky dopočítáme novou metriku – průměr yardů na jednu akci. 
* Fáze `$lookup` a `$unwind` nahrazují operaci JOIN z relačních databází a slouží k napojení plných názvů týmů. 
* Po formátování přes `$project` a seřazení (`$sort`) přichází finální a klíčová fáze `$merge`. 
* Ta výsledek agregace nevypíše pouze dočasně na obrazovku, ale trvale ho uloží do nové kolekce team_season_summary (případně ho aktualizuje, pokud už existuje). 
* Tento přístup představuje masivní úsporu výpočetního výkonu databáze, protože klientské aplikace mohou číst už předpočítaná data z této nové kolekce, místo aby spouštěly složitou agregaci pořád dokola.

## Indexy a optimalizace

### Dotaz 13 Vytvoření složeného indexu (Compound Index) pro krizové situace

````javascript
db.plays.createIndex(
  { posteam: 1, down: 1, yards_gained: -1 }, 
  { name: "idx_team_down_yards" }
)
````

#### Vysvětlení
* Vytvoření složeného (Compound) B-Tree indexu.
* Nejde o obyčejný index na jeden sloupec, ale o datovou strukturu kombinující tři různé klíče s různými směry řazení (1 pro vzestupné, -1 pro sestupné).
* Tento konkrétní index je navržen přesně pro potřeby naší aplikace, která často vyhledává akce určitého týmu při konkrétním downu a rovnou je potřebuje řadit od nejdelšího zisku. 
* Návratovou hodnotou je JSON potvrzující úspěšné vytvoření struktury na pozadí databáze.

### Dotaz 14 Netriviální důkaz optimalizace (Explain Plan s vnořeným filtrem)
Vyhledej všechny akce týmu "KC" při 3. downu, kde získali více než 15 yardů. Místo samotných dat ale vypiš kompletní exekuční plán databáze (executionStats), abys dokázal, že databáze skutečně použila index z Dotazu 13 a neprohledávala zbytečně statisíce záznamů.
````javascript
db.plays.find(
  { posteam: "KC", down: 3, yards_gained: { $gt: 15 } }
).explain("executionStats")
````

#### Vysvětlení
* Tento dotaz využívá metodu .explain("executionStats"), což je klíčový nástroj pro ladění výkonu. Namísto herních dat vrací komplexní JSON dokument s metadaty o tom, jak databázový engine (WiredTiger) dotaz zpracoval. 
* Ve výstupu hledáme především parametr "stage": "IXSCAN" (Index Scan), který dokazuje, že byl k vyhledání použit nově vytvořený idx_team_down_yards. 
* Kdyby tam bylo COLLSCAN (Collection Scan), znamenalo by to fatální selhání optimalizace. 
* Vrácená metadata jasně ukazují, kolik milisekund operace trvala a kolik dokumentů bylo reálně prozkoumáno.

### Dotaz 15 Vytvoření váženého Full-textového indexu (Text Index)
Vytvoř nad kolekcí soupisek (rosters) textový index na sloupce celého jména a názvu univerzity. Nastav "váhu" (weight) tak, aby shoda ve jméně byla 5x důležitější než shoda v názvu univerzity.
````javascript
db.rosters.createIndex(
  { full_name: "text", college: "text" },
  { 
    default_language: "english", 
    weights: { full_name: 5, college: 1 },
    name: "idx_roster_fulltext" 
  }
)
````

#### Vysvětlení
* Běžné indexy neumožňují hledat jednotlivá slova uvnitř dlouhých řetězců. 
* Zde nasazujeme specifický textový index, který provádí tokenizaci (rozsekání na slova) a ignoruje tzv. stop-words v angličtině. 
* Jedná se o netriviální konfiguraci, protože index kombinuje více textových polí a pomocí parametru weights explicitně definuje matematickou relevanci (shoda ve jméně má pětinásobnou hodnotu oproti shodě v univerzitě).

### Dotaz 16 Agregace spojená s Full-textovým hledáním a rankingem
Pomocí agregační roury vyhledej hráče, kteří mají něco společného se slovem "Williams", ale zároveň pomocí logického operátoru vyluč (mínus) ty z univerzity "Texas". Výsledky seřaď podle algoritmicky vypočítaného skóre relevance a omez na Top 3.
````javascript
db.rosters.aggregate([
  { $match: { $text: { $search: "Williams -Texas" } } },
  { $addFields: { relevance_score: { $meta: "textScore" } } },
  { $sort: { relevance_score: -1 } },
  { $limit: 3 },
  { $project: { _id: 0, full_name: 1, college: 1, relevance_score: { $round: ["$relevance_score", 2] } } }
])
````

#### Vysvětlení
* Příklad integrace fulltextového indexu přímo do agregační roury. 
* V bloku `$match` spouštíme textové hledání s využitím boolovské logiky (znak - slouží jako negace). 
* Databáze při vyhledávání v textovém indexu interně počítá relevanci výsledků. 
* Abychom s tímto skóre mohli pracovat, musíme ho pomocí speciálního příkazu { `$meta`: "textScore" } vytáhnout na světlo v bloku `$addFields`. 
* Následně podle něj data seřadíme a v $project skóre zaokrouhlíme. Dotaz tedy nevrací jen náhodné shody, ale seřazený ranking.

### Dotaz 17 Ušetření paměti RAM pomocí Částečného indexu (Partial Index)
Vytvoř index nad hráčskými statistikami pro rychlé hledání podle pozice a počtu touchdownů. Z důvodu úspory drahé operační paměti (RAM) do tohoto indexu ale zahrň pouze nadprůměrné hráče, kteří nahráli alespoň 15 touchdownů (passing nebo rushing).
````javascript
db.player_stats.createIndex(
  { position: 1, passing_tds: -1 },
  { 
    partialFilterExpression: { 
        $or: [ { passing_tds: { $gte: 15 } }, { rushing_tds: { $gte: 15 } } ] 
    },
    name: "idx_elite_scorers_partial" 
  }
)
````

#### Vysvětlení
* Standardní indexy mapují každý jednotlivý dokument v kolekci, což při milionech záznamů enormně zatěžuje paměť serveru. 
* Tento dotaz ukazuje pokročilou databázovou architekturu – vytvoření tzv. Partial (částečného) indexu. 
* Pomocí partialFilterExpression a logického operátoru `$or` dáváme databázi pokyn, aby do indexového B-Tree stromu fyzicky uložila odkazy pouze na ty dokumenty, které reprezentují elitní hráče. 
* Index je díky tomu extrémně malý, bleskově rychlý a nezahltí systémové prostředky.

### Dotaz 18 Analýza využití indexů agregací ($indexStats)
Zadání v přirozeném jazyce: Spusť systémovou agregační rouru na kolekci rosters, abys získal telemetrická data o tom, jak často jsou jednotlivé indexy v této kolekci reálně využívány (kolikrát na ně databáze "sáhla" od posledního restartu). Zobraz jen názvy indexů a počet jejich použití.
````javascript
db.rosters.aggregate([
  { $indexStats: {} },
  { $project: {
      _id: 0,
      index_name: "$name",
      usage_count: "$accesses.ops",
      tracking_since: "$accesses.since"
  } },
  { $sort: { usage_count: -1 } }
])
````

#### Vysvětlení 
* Tento netriviální dotaz demonstruje schopnost pracovat v MongoDB nejen se samotnými uživatelskými daty, ale i s interní systémovou telemetrií. 
* Operátor `$indexStats` je speciální agregační fáze (musí být vždy jako první v rouře), která vrací metadata o využití paměťových struktur. 
* Následně pomocí $project tyto nepřehledné systémové logy přemapujeme do čistých a srozumitelných polí (název indexu, počet použití) a seřadíme. 
* Jde o typický dotaz databázového administrátora (DBA) při auditu výkonu clusteru.

## Nested (Embedded) Dokumenty a Strukturální změny

### Dotaz 19 Vytvoření zanořeného pole hráčů v profilu týmu (Strukturální transformace)
Vezmi všechny hráče ze soupisek, spoj je s informacemi o jejich týmech a vyfiltruj pouze hráče hrající v konferenci AFC. Následně změň plochou strukturu dat – vytvoř pro každý AFC tým jeden hlavní dokument, který bude uvnitř sebe obsahovat zanořené pole (roster_players) se seznamem jeho hráčů a jejich fyzickými parametry. Výsledek seřaď abecedně.

````javascript
db.rosters.aggregate([
  { $lookup: { from: "teams", localField: "team", foreignField: "team_abbr", as: "team_info" } },
  { $unwind: "$team_info" },
  { $match: { "team_info.team_conf": "AFC" } },
  { $group: { 
      _id: "$team_info.team_name", 
      total_players: { $sum: 1 },
      roster_players: { 
          $push: { name: "$full_name", position: "$position", weight: "$weight" } 
      }
  } },
  { $sort: { _id: 1 } },
  { $limit: 3 }
])
````

#### Ukázka části výsledku
````javascript
[
  {
    _id: 'Baltimore Ravens',
    total_players: 78,
    roster_players: [
      { name: 'John Jenkins', position: 'DL', weight: 360 },
      { name: 'Laken Tomlinson', position: 'OL', weight: 312 },
      { name: 'Chidobe Awuzie', position: 'DB', weight: 202 },
      { name: 'Lamar Jackson', position: 'QB', weight: 205 },
      { name: 'Taven Bryan', position: 'DL', weight: 291 },
      { name: 'Justice Hill', position: 'RB', weight: 205 },
      { name: 'Amani Oruwariye', position: 'DB', weight: 203 },
      { name: 'Broderick Washington', position: 'DL', weight: 315 },
      { name: 'Alohi Gilman', position: 'DB', weight: 202 },
      { name: 'Jacob Hummel', position: 'LB', weight: 235 },
      { name: 'Travis Jones', position: 'DL', weight: 341 },
      { name: 'Tyler Linderbaum', position: 'OL', weight: 305 },
      { name: 'Keaton Mitchell', position: 'RB', weight: 190 },
      { name: 'Daniel Faalele', position: 'OL', weight: 370 },
      { name: 'Basil Okoye', position: 'DL', weight: 315 },
      { name: 'T.J. Tampa', position: 'DB', weight: 200 },
      { name: 'Baylor Cupp', position: 'TE', weight: 260 },
      { name: 'Rasheen Ali', position: 'RB', weight: 209 },
      { name: 'David Olajiga', position: 'DL', weight: 270 },
      { name: 'Robert Longerbeam', position: 'DB', weight: 178 },
      { name: 'Desmond Igbinosun', position: 'DB', weight: 213 },
      { name: 'Keondre Jackson', position: 'DB', weight: 215 },
      { name: 'Keyon Martin', position: 'DB', weight: 166 },
      { name: 'Lucas Scott', position: 'RB', weight: 305 },
      { name: 'Malaki Starks', position: 'DB', weight: 205 },
      { name: 'DeAndre Hopkins', position: 'WR', weight: 212 },
      { name: 'Ronnie Stanley', position: 'OL', weight: 310 },
      { name: 'Marlon Humphrey', position: 'DB', weight: 210 },
      { name: 'Josh Tupou', position: 'DL', weight: 345 },
      { name: 'Carl Lawson', position: 'DL', weight: 265 },
      { name: 'Roquan Smith', position: 'LB', weight: 235 },
      { name: 'Nnamdi Madubuike', position: 'DL', weight: 305 },
      { name: 'Tyler Huntley', position: 'QB', weight: 205 },
      { name: "Ar'Darius Washington", position: 'DB', weight: 178 },
      { name: 'Rashod Bateman', position: 'WR', weight: 193 },
      { name: 'Isaiah Likely', position: 'TE', weight: 245 },
      { name: 'Kyle Hamilton', position: 'DB', weight: 220 },
      { name: 'Charlie Kolar', position: 'TE', weight: 265 },
      { name: 'Zay Flowers', position: 'WR', weight: 183 },
      { name: 'Dayton Wade', position: 'WR', weight: 175 },
      { name: 'Corey Bullock', position: 'OL', weight: 320 },
      { name: 'Carl Jones', position: 'LB', weight: 230 },
      { name: 'Adisa Isaac', position: 'LB', weight: 249 },
      { name: 'Devontez Walker', position: 'WR', weight: 200 },
      { name: 'Emery Jones Jr.', position: 'OL', weight: 315 },
      { name: 'Jahmal Banks', position: 'WR', weight: 205 },
      { name: 'Gerad Lichtenhan', position: 'OL', weight: 315 },
      { name: 'Jay Higgins', position: 'LB', weight: 230 },
      { name: 'Jared Penning', position: 'OL', weight: 338 },
      { name: 'Marquise Robinson', position: 'DB', weight: 192 },
      { name: 'Brent Urban', position: 'DL', weight: 300 },
      { name: 'Kyle Van Noy', position: 'LB', weight: 255 },
      { name: 'Derrick Henry', position: 'RB', weight: 252 },
      { name: 'Patrick Ricard', position: 'RB', weight: 300 },
      { name: 'Cooper Rush', position: 'QB', weight: 225 },
      { name: 'Mark Andrews', position: 'TE', weight: 250 },
      { name: 'Joe Noteboom', position: 'OL', weight: 321 },
      { name: "Dre'Mont Jones", position: 'LB', weight: 281 },
      { name: 'Tylan Wallace', position: 'WR', weight: 200 },
      { name: 'Jordan Stout', position: 'P', weight: 209 },
      { name: 'David Ojabo', position: 'LB', weight: 250 },
      { name: 'Andrew Vorhees', position: 'OL', weight: 320 },
      { name: 'Trenton Simpson', position: 'LB', weight: 230 },
      { name: 'Tavius Robinson', position: 'LB', weight: 265 },
      { name: 'Nate Wiggins', position: 'DB', weight: 185 },
      { name: 'Roger Rosengarten', position: 'OL', weight: 316 },
      { name: 'Cornelius Johnson', position: 'WR', weight: 208 },
      { name: 'Devin Leary', position: 'QB', weight: 212 },
      { name: 'Teddye Buchanan', position: 'LB', weight: 240 },
      { name: 'Carson Vinson', position: 'OL', weight: 321 },
      { name: 'Bilhal Kone', position: 'DB', weight: 190 },
      { name: 'Tyler Loop', position: 'K', weight: 190 },
      { name: 'LaJohntay Wester', position: 'WR', weight: 170 },
      { name: 'Aeneas Peebles', position: 'DL', weight: 290 },
      { name: 'Xavier Guillory', position: 'WR', weight: 200 },
      { name: 'Chandler Martin', position: 'LB', weight: 230 },
      { name: 'Kaimon Rucker', position: 'DL', weight: 265 },
      { name: 'Mike Green', position: 'LB', weight: 248 }
    ]
  }
]
````

#### Vysvětlení
* Dotaz demonstruje klíčovou výhodu NoSQL databází – schopnost restrukturalizovat plochá data (relational-like) do hierarchických zanořených dokumentů (embedded documents). 
* Dotaz využívá komplexní agregační rouru. 
* Nejdříve pomocí fází `$lookup` a `$unwind` propojí hráče s jejich týmy. 
* Zásadní je, že následný `$match` nefiltruje podle původní kolekce, ale až podle nově připojených dat (konference AFC). 
* Nejdůležitějším krokem je `$group`, kde pomocí operátoru $push nesčítáme jen čísla, ale za běhu vytváříme masivní zanořené pole objektů roster_players, do kterého vkládáme vybrané atributy hráčů. 
* Závěrečný `$sort` data seřadí.

### Dotaz 20 Filtrace uvnitř zanořeného pole (Bez Unwindu)
Najdi všechny Quarterbacky (QB) na soupiskách a připoj k nim pole se všemi jejich herními statistikami ze sezóny. Z tohoto zanořeného pole však dynamicky vymaž všechny slabé zápasy a ponech uvnitř pouze ty, kde hráč nahrál více než 300 yardů. Výsledný seznam omez pouze na hráče, kterým po této filtraci zbyl alespoň jeden takový "elitní" zápas, a seřaď je abecedně.
````javascript
db.rosters.aggregate([
  { $match: { position: "QB" } },
  { $lookup: { 
      from: "player_stats", 
      localField: "gsis_id", 
      foreignField: "player_id", 
      as: "season_stats" 
  } },
  { $project: {
      _id: 0,
      full_name: 1,
      team: 1,
      elite_games: {
          $filter: {
              input: "$season_stats",
              as: "stat",       
              cond: { $gt: ["$$stat.passing_yards", 300] }
          }
      }
  } },
  { $match: { "elite_games.0": { $exists: true } } },
  { $sort: { full_name: 1 } },
  { $limit: 5 }
])
````

#### Ukázka části výsledku
````javascript
[
  {
    team: 'PIT',
    full_name: 'Aaron Rodgers',
    elite_games: [
      {
        _id: ObjectId('69e8a6a1226c2331143c9842'),
        player_id: '00-0023459',
        player_display_name: 'Aaron Rodgers',
        position: 'QB',
        position_group: 'QB',
        recent_team: 'PIT',
        games: 17,
        passing_yards: 3468,
        passing_tds: 24,
        rushing_yards: 61,
        receiving_yards: -9,
        fantasy_points: 227.92,
        sacks_suffered: 33,
        sack_fumbles: 5,
        sack_fumbles_lost: 2,
        passing_first_downs: 150
      }
    ]
  },
  {
    team: 'TB',
    full_name: 'Baker Mayfield',
    elite_games: [
      {
        _id: ObjectId('69e8a6a1226c2331143c99cc'),
        player_id: '00-0034855',
        player_display_name: 'Baker Mayfield',
        position: 'QB',
        position_group: 'QB',
        recent_team: 'TB',
        games: 17,
        passing_yards: 3693,
        passing_tds: 26,
        rushing_yards: 382,
        receiving_yards: 0,
        fantasy_points: 271.92,
        sacks_suffered: 36,
        sack_fumbles: 10,
        sack_fumbles_lost: 3,
        passing_first_downs: 172
      }
    ]
  }]
````

#### Vysvětlení
* Tento dotaz ukazuje pokročilou práci s vnořenými (nested) poli. 
* Počáteční `$match` a `$lookup` vytvoří standardní strukturu, kdy má hráč v sobě zanořené pole svých statistik. 
* Místo běžného (a výpočetně náročného) použití operátoru `$unwind` využíváme ve fázi $project operátor `$filter`. 
* Tento operátor funguje jako iterátor (smyčka) – projde vnořené pole season_stats, za pomoci lokální proměnné $$stat zkontroluje každý jednotlivý záznam, a pokud naházené yardy nepřekročí 300, objekt z pole trvale odstraní. 
* Následná fáze `$match` používá pokročilou tečkovou notaci s indexem pole `("elite_games.0": { $exists: true })`, kterou efektivně odfiltrujeme hráče, jimž po aplikaci $filter zůstalo pouze prázdné pole `[]`

### Dotaz 21 Extrakce a řezání zanořeného pole (Deep Object Match a $slice)
Analyzuj přihrávkové akce (pass) a seskup je podle herního downu a unikátního ID přijímajícího hráče (receiver). Pro každou tuto unikátní kombinaci vytvoř zanořené pole konkrétních akcí. Následně z těchto vytvořených zanořených struktur vyfiltruj pouze záznamy pro konkrétního elitního hráče (např. receiver s ID "00-0036971"). Výstup uprav tak, aby u každého downu zobrazoval průměrný zisk yardů a jako ukázku vždy pouze dvě konkrétní akce ze zanořeného pole.

```javascript
db.plays.aggregate([
  { $match: { 
      play_type: "pass", 
      receiver_player_id: { $exists: true, $ne: null } 
  } },
  { $group: {
      _id: { down: "$down", receiver: "$receiver_player_id" },
      plays_array: { $push: { yards: "$yards_gained", play_id: "$play_id" } },
      avg_yards: { $avg: "$yards_gained" }
  } },
  { $match: { "_id.receiver": "00-0038559" } },
  { $project: { 
      _id: 0, 
      down: "$_id.down", 
      avg_yards: { $round: ["$avg_yards", 1] }, 
      sample_plays: { $slice: ["$plays_array", 2] } 
  } },
  { $sort: { down: 1 } }
])
```

#### Výsledek
````javascript
[
  {
    down: null,
    avg_yards: 0,
    sample_plays: [ { yards: 0, play_id: 3578 } ]
  },
  {
    down: 1,
    avg_yards: 10,
    sample_plays: [ { yards: 0, play_id: 2418 }, { yards: 11, play_id: 2422 } ]
  },
  {
    down: 2,
    avg_yards: 7.6,
    sample_plays: [ { yards: 30, play_id: 4123 }, { yards: 0, play_id: 372 } ]
  },
  {
    down: 3,
    avg_yards: 6.5,
    sample_plays: [ { yards: 0, play_id: 622 }, { yards: 0, play_id: 3752 } ]
  },
  {
    down: 4,
    avg_yards: 6.2,
    sample_plays: [ { yards: 0, play_id: 3880 }, { yards: 15, play_id: 4012 } ]
  }
]
````

#### Vysvětlení
* Tento dotaz je ukázkou komplexní manipulace se zanořenými objekty a poli. 
* Ve fázi '$group' vytváříme nejen zanořené pole plays_array (pomocí operátoru $push), ale definujeme také tzv. složený klíč _id, což je vlastně vnořený (nested) JSON objekt obsahující číslo downu a ID hráče. 
* Zásadním krokem je navazující '$match', který prohledává data přímo uvnitř tohoto složeného objektu za pomoci speciální tečkové notace (_id.receiver). 
* Ve fázi projekce pak demonstrujeme použití operátoru `$slice`. 
* Ten zamezí tomu, aby databáze zbytečně posílala na klienta pole s tisíci záznamy, a "odřízne" z něj pouze první dva objekty jako reprezentativní vzorek. 
* Tímto dotazem dosahujeme maximální přesnosti a efektivity při přenosu dat.


### Dotaz 22 Povýšení zanořeného objektu do hlavního kořene ($replaceRoot)
Najdi všechny zápasy, které se hrály venku na otevřených stadionech (outdoors). K těmto zápasům připoj detailní profil hostujícího týmu z kolekce teams. Následně vezmi tento zanořený profil hostujícího týmu, připoj k němu počet bodů, které v tomto zápase získal, a povyš tento nově vytvořený objekt tak, aby zcela nahradil původní strukturu dokumentu o zápase. Zobraz Top 5 týmů, které venku skórovaly nejvíce bodů.
````javascript
db.games.aggregate([
  { $match: { roof: "outdoors" } },
  { $lookup: { 
      from: "teams", 
      localField: "away_team", 
      foreignField: "team_abbr", 
      as: "away_details" 
  } },
  { $unwind: "$away_details" },
  { $group: {
      _id: "$game_id",
      game_info: { $first: { week: "$week", away_score: "$away_score" } },
      away_team_nested: { $first: "$away_details" }
  } },
  { $replaceRoot: { 
      newRoot: { 
          $mergeObjects: [
              "$away_team_nested", 
              { points_scored_outdoors: "$game_info.away_score", week_played: "$game_info.week" }
          ] 
      } 
  } },
  { $project: { _id: 0 } },
  { $sort: { points_scored_outdoors: -1 } },
  { $limit: 5 }
])
````

#### Výsledek
````javascript
[
  {
    team_abbr: 'CHI',
    team_name: 'Chicago Bears',
    team_id: 810,
    team_conf: 'NFC',
    team_division: 'NFC North',
    points_scored_outdoors: 47,
    week_played: 9
  },
  {
    team_abbr: 'CIN',
    team_name: 'Cincinnati Bengals',
    team_id: 920,
    team_conf: 'AFC',
    team_division: 'AFC North',
    points_scored_outdoors: 45,
    week_played: 16
  },
  {
    team_abbr: 'HOU',
    team_name: 'Houston Texans',
    team_id: 2120,
    team_conf: 'AFC',
    team_division: 'AFC South',
    points_scored_outdoors: 44,
    week_played: 5
  },
  {
    team_abbr: 'DET',
    team_name: 'Detroit Lions',
    team_id: 1540,
    team_conf: 'NFC',
    team_division: 'NFC North',
    points_scored_outdoors: 44,
    week_played: 10
  },
  {
    team_abbr: 'LA',
    team_name: 'Los Angeles Rams',
    team_id: 2510,
    team_conf: 'NFC',
    team_division: 'NFC West',
    points_scored_outdoors: 42,
    week_played: 10
  }
]
````

#### Vysvětlení
* Tento netriviální dotaz demonstruje schopnost dynamicky měnit architekturu databáze "za letu". 
* Jádrem tohoto dotazu je systémová fáze `$replaceRoot`. 
* Po odfiltrování venkovních zápasů a napojení týmových profilů (`$lookup`) nejprve vytvoříme dočasný dokument, který obsahuje zanořený profil hostujícího týmu (away_team_nested). 
* Ve fázi `$replaceRoot` využijeme operátor `$mergeObjects`, kterým spojíme tento profil s konkrétními daty ze zápasu (body, týden), a tento sloučený objekt povýšíme na úroveň "Root" (hlavní uzel dokumentu). 
* Všechny původní informace o zápase jsou zahozeny. Na výstupu tedy nedostáváme "zápasy se zanořeným týmem", ale "profily týmů obohacené o zápasové statistiky"


### Dotaz 23 Konstrukce strukturovaného profilu (Nested Objects ze sloupců)
Vezmi plochá data z kolekce soupisek (rosters) a restrukturalizuj je tak, aby fyzické atributy (váha, výška) tvořily jeden vnořený objekt a kariérní data (rok draftu, status, univerzita) tvořily druhý vnořený objekt. Zobraz hráče z univerzity "Ohio State", a následně vyhledej uvnitř nově vytvořeného zanořeného objektu pouze ty, kteří váží více než 220 liber.
````javascript
db.rosters.aggregate([
  { $match: { college: "Ohio State" } },
  { $project: {
      _id: 0,
      player_name: "$full_name",
      team: 1,
      physical_metrics: {
          weight_lbs: "$weight",
          height_inches: "$height"
      },
      career_info: {
          rookie_year: "$rookie_year",
          status: "$status",
          college: "$college"
      }
  } },
  { $match: { "physical_metrics.weight_lbs": { $gt: 220 } } },
  { $sort: { "career_info.rookie_year": -1 } },
  { $limit: 4 }
])
````

#### Výsledek
````javascript
[
  {
    team: 'DET',
    player_name: 'Tyleik Williams',
    physical_metrics: { weight_lbs: 328, height_inches: 75 },
    career_info: { rookie_year: 2025, college: 'Ohio State' }
  },
  {
    team: 'IND',
    player_name: 'JT Tuimoloau',
    physical_metrics: { weight_lbs: 270, height_inches: 76 },
    career_info: { rookie_year: 2025, college: 'Ohio State' }
  },
  {
    team: 'LA',
    player_name: 'Ty Hamilton',
    physical_metrics: { weight_lbs: 295, height_inches: 75 },
    career_info: { rookie_year: 2025, college: 'Ohio State' }
  },
  {
    team: 'ARI',
    player_name: 'Cody Simon',
    physical_metrics: { weight_lbs: 235, height_inches: 74 },
    career_info: { rookie_year: 2025, college: 'Ohio State' }
  }
]
````

#### Vysvětlení
* Tento dotaz skvěle ilustruje převod plochého (relational-like) datového schématu na hierarchické NoSQL schéma přímo během dotazování. 
* Fáze `$project` nedeleguje pouze existující sloupce, ale explicitně vytváří nové nadřazené klíče (physical_metrics, career_info), do kterých zanořuje původní hodnoty jako objekty. 
* Následný operátor `$match` jasně demonstruje, jak se v takovéto nově vytvořené zanořené struktuře dá okamžitě a efektivně vyhledávat za pomoci tečkové notace (physical_metrics.weight_lbs). 
* Z výstupu je patrná čistá, objektově orientovaná struktura dokumentu.

### Dotaz 24 Skupinová agregace se zanořováním do více polí (Kategorizace)
Analyzuj ofenzivní sílu týmů. Projdi všechny ofenzivní akce z kolekce plays, které skončily ziskem více než 15 yardů ("explosive plays"). Tyto akce seskup podle útočícího týmu a vytvoř pro každý tým dokument se dvěma oddělenými zanořenými (nested) poli – jedním výhradně pro dlouhé přihrávky (pass) a druhým výhradně pro dlouhé běhy (run). Na výstupu zobraz počty těchto akcí a jako ukázku vypiš vždy maximálně dvě akce z každé kategorie. Omez na Top 3 týmy s nejvíce dlouhými přihrávkami.

`````javascript
db.plays.aggregate([
  { $match: { play_type: { $in: ["pass", "run"] }, yards_gained: { $gt: 15 } } },
  { $sort: { yards_gained: -1 } },
  { $group: {
      _id: "$posteam",
      explosive_passes: {
          $push: {
              $cond: [ 
                  { $eq: ["$play_type", "pass"] }, 
                  { yards: "$yards_gained", down: "$down" }, 
                  "$$REMOVE" 
              ]
          }
      },
      explosive_runs: {
          $push: {
              $cond: [ 
                  { $eq: ["$play_type", "run"] }, 
                  { yards: "$yards_gained", down: "$down" }, 
                  "$$REMOVE" 
              ]
          }
      }
  } },
  { $project: {
      team: "$_id",
      _id: 0,
      pass_count: { $size: "$explosive_passes" },
      run_count: { $size: "$explosive_runs" },
      explosive_passes: { $slice: ["$explosive_passes", 2] },
      explosive_runs: { $slice: ["$explosive_runs", 2] }
  } },
  { $sort: { pass_count: -1 } },
  { $limit: 3 }
])
`````

#### Výsledek
````javascript
[
  {
    team: 'LA',
    pass_count: 121,
    run_count: 19,
    explosive_passes: [ { yards: 88, down: 1 }, { yards: 58, down: 3 } ],
    explosive_runs: [ { yards: 48, down: 1 }, { yards: 45, down: 4 } ]
  },
  {
    team: 'NE',
    pass_count: 121,
    run_count: 30,
    explosive_passes: [ { yards: 72, down: 1 }, { yards: 58, down: 3 } ],
    explosive_runs: [ { yards: 69, down: 2 }, { yards: 65, down: 1 } ]
  },
  {
    team: 'CHI',
    pass_count: 106,
    run_count: 23,
    explosive_passes: [ { yards: 65, down: 1 }, { yards: 58, down: 1 } ],
    explosive_runs: [ { yards: 39, down: 1 }, { yards: 31, down: 1 } ]
  }
]
````

#### Vysvětlení
* Tento dotaz představuje extrémně komplexní podmíněnou manipulaci s poli (Conditional Array Push). 
* Po odfiltrování dlouhých akcí (nad 15 yardů) a jejich seřazení seskupujeme data podle útočícího týmu. 
* Uvnitř operátorů `$push` (které vytváří zanořená pole) využíváme logický operátor `$cond`. Tím říkáme databázi: Pokud je typ akce "pass", vlož objekt s yardy do pole explosive_passes. Pokud ne, použij systémovou proměnnou $$REMOVE, která prvek ignoruje a do pole nic nevloží. 
* Inverzně to stejné platí pro pole explosive_runs. 
* Ve fázi `$project` následně dynamicky počítáme délku těchto nově vygenerovaných polí pomocí operátoru $size a pomocí `$slice` odřízneme zbytek pole tak, abychom na klienta poslali z každé zanořené kategorie pouze dvě ukázkové akce. 
* Tím vzniká vysoce strukturovaný analytický report.