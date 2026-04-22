const GameTypeEnum = {
    REGULAR: "REG",
    WILDCARD: "WC",
    DIVISION: "DIV",
    CONFERENCE: "CON",
    SUPERBOWL: "SB",
}

const ConferenceEnum = {
    NFC: "NFC",
    AFC: "AFC",
}

const DivisionEnum = {
    NFC_WEST: 'NFC West',
    NFC_EAST: 'NFC East',
    NFC_SOUTH: 'NFC South',
    NFC_NORTH: 'NFC North',
    AFC_WEST: 'AFC West',
    AFC_EAST: 'AFC East',
    AFC_SOUTH: 'AFC South',
    AFC_NORTH: 'AFC North',
};

const RoofTypeEnum = {
    OUTDOORS: "outdoors",
    DOME: "dome",
    CLOSED: "closed",
}

sh.enableSharding("nfl_db")

db = db.getSiblingDB("nfl_db");

db.createCollection("games", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            title: "NFL season games validation schema",
            required: ["game_id", "season", "week", "game_type", "home_team", "away_team", "home_score", "away_score", "roof"],
            properties: {
                game_id: {
                    bsonType: "string",
                    description: "game_id has to be string and is required"
                },
                season: {
                    bsonType: ["int", "long"],
                    description: "season has to be integer or long and is required"
                },
                week: {
                    bsonType: "int",
                    description: "week has to be integer, minimal value is 1 and is required",
                    minimum: 1,
                },
                game_type: {
                    enum: Object.values(GameTypeEnum),
                    description: "game_type has to be one of the following: REG, WC, DIV, CON, SB and is required"
                },
                home_team: {
                    bsonType: "string",
                    description: "home_team has to be string and is required"
                },
                away_team: {
                    bsonType: "string",
                    description: "away_team has to be string and is required"
                },
                home_score: {
                    bsonType: "int",
                    minimum: 0,
                    description: "home_score has to be integer, minimal value is 0 and is required"
                },
                away_score: {
                    bsonType: "int",
                    minimum: 0,
                    description: "away_score has to be integer, minimal value is 0 and is required"
                },
                roof: {
                    enum: Object.values(RoofTypeEnum),
                    description: "roof has to be one of the following: dome, outdoors, closed and is required"
                },
                stadium: {
                    bsonType: ["string", "null"],
                    description: "stadium has to be string if provided, otherwise is optional"
                }
            }
        }
    }
})


db.createCollection("teams", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            title: "NFL teams validation schema",
            required: ["team_abbr", "team_name", "team_id", "team_conf", "team_division"],
            properties: {
                team_abbr: {
                    bsonType: "string",
                    description: "team_abbr has to be string and is required"
                },
                team_name: {
                    bsonType: "string",
                    description: "team_name has to be string and is required"
                },
                team_id: {
                    bsonType: ["int", "long"],
                    description: "team_id has to be long or integer, minimal value is 0 and is required",
                    minimum: 0,
                },
                team_conf: {
                    enum: Object.values(ConferenceEnum),
                    description: "team_conf has to be one of the following: NFC, AFC and is required"
                },
                team_division: {
                    enum: Object.values(DivisionEnum),
                    description: "team_division has to be one of the following: NFC West, NFC East, NFC North, NFC South, AFC West, AFC East, AFC North, AFC South and is required"
                }
            }
        }
    }
})

db.createCollection("rosters", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            title: "NFL teams rosters validation schema",
            required: ["team", "position", "weight", "full_name", "entry_year", "rookie_year"],
            properties: {
                gsis_id: {
                    bsonType: ["string", "null"],
                    description: "gsis_id has to be string if provided, otherwise is optional"
                },
                team: {
                    bsonType: "string",
                    description: "team has to be string and is required"
                },
                position: {
                    bsonType: "string",
                    description: "position has to be string and is required"
                },
                full_name: {
                    bsonType: "string",
                    description: "full_name has to be string and is required"
                },
                weight: {
                    bsonType: ["int", "double"],
                    description: "weight has to be integer or double, minimum value is 0 and is required",
                    minimum: 0,
                },
                height: {
                    bsonType: ["int", "double", "null"],
                    description: "height has to be integer or double, minimum value is 0 and is optional",
                    minimum: 0
                },
                college: {
                    bsonType: ["string", "null"],
                    description: "college has to be string if provided, otherwise is optional"
                },
                entry_year: {
                    bsonType: ["int", "long"],
                    description: "entry_year has to be long or integer, minimal value is 1900 and is required",
                    minimum: 1900,
                },
                rookie_year: {
                    bsonType: ["int", "long"],
                    description: "rookie_year has to be long or integer, minimal value is 1900 and is required",
                    minimum: 1900,
                },
            }
        }
    }
})

db.createCollection("player_stats", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            title: "NFL player stats validation schema",
            required: ["recent_team", "games", "passing_yards", "passing_tds", "rushing_yards", "receiving_yards", "fantasy_points", "sacks_suffered", "sack_fumbles", "sack_fumbles_lost", "passing_first_downs"],
            properties: {
                player_id: {
                    bsonType: ["string", "null"],
                    description: "player_id has to be string if provided, otherwise is optional"
                },
                player_display_name: {
                    bsonType: ["string", "null"],
                    description: "player_display_name has to be string if provided, otherwise is optional"
                },
                position: {
                    bsonType: ["string", "null"],
                    description: "position has to be string if provided, otherwise is optional"
                },
                position_group: {
                    bsonType: ["string", "null"],
                    description: "position_group has to be string if provided, otherwise is optional"
                },
                recent_team: {
                   bsonType: "string",
                    description: "recent_team has to be string and is required"
                },
                games: {
                    bsonType: "int",
                    description: "games has to be integer, minimum value is 0 and is required",
                    minimum: 0
                },
                passing_yards: {
                    bsonType: ["int", "double", "long"],
                    description: "passing_yards has to be integer, double or long and is required"
                },
                passing_tds: {
                    bsonType: "int",
                    description: "passing_tds has to be integer, minimal value is 0 and is required",
                    minimum: 0,
                },
                rushing_yards: {
                    bsonType: ["int", "double", "long"],
                    description: "rushing_yards has to be integer, double or long and is required",
                },
                receiving_yards: {
                    bsonType: ["int", "double", "long"],
                    description: "receiving_yards has to be integer, double or long and is required",
                },
                fantasy_points: {
                    bsonType: ["int", "double", "long"],
                    description: "fantasy_points has to be integer, double or long and is required",
                },
                sacks_suffered: {
                    bsonType: "int",
                    description: "sacks_suffered has to be integer, minimal value is 0 and is required",
                    minimum: 0,
                },
                sack_fumbles: {
                    bsonType: "int",
                    description: "sack_fumbles has to be integer, minimal value is 0 and is required",
                    minimum: 0,
                },
                sack_fumbles_lost: {
                    bsonType: "int",
                    description: "sack_fumbles_lost has to be integer, minimal value is 0 and is required",
                    minimum: 0,
                },
                passing_first_downs: {
                    bsonType: "int",
                    description: "passing_first_downs has to be integer, minimal value is 0 and is required",
                    minimum: 0,
                },
            }
        }
    }
})


db.createCollection("plays", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            title: "NFL play by plays stats validation schema",
            required: ["game_id", "play_id", "play_type", "ydstogo", "yards_gained"],
            properties: {
                game_id: {
                    bsonType: "string",
                    description: "game_id has to be string and is required"
                },
                play_id: {
                    bsonType: ["int", "long"],
                    description: "play_id has to be integer, minimum value is 0 and is required",
                    minimum: 0
                },
                play_type: {
                    bsonType: "string",
                    description: "play_type has to be string and is required"
                },
                posteam: {
                    bsonType: "string",
                    description: "posteam has to be string if provided, otherwise is optional"
                },
                defteam: {
                   bsonType: "string",
                    description: "defteam has to be string if provided, otherwise is optional"
                },
                down: {
                    bsonType: ["int", "double", "null"],
                    description: "down has to be int or double or null, values 1-4",
                    minimum: 1,
                    maximum: 4,
                },
                ydstogo: {
                    bsonType: "int",
                    description: "ydstogo has to be integer and is required",
                    minimum: 0,
                    maximum: 100,
                },
                yards_gained: {
                    bsonType: ["int", "double"],
                    description: "yards_gained has to be integer and is required",
                },
                passer_player_id: {
                    bsonType: ["string", "null"],
                    description: "passer_player_id has to be string, if provided, otherwise is optional",
                },
                receiver_player_id: {
                    bsonType: ["string", "null"],
                    description: "receiver_player_id has to be string, if provided, otherwise is optional",
                },
                rusher_player_id: {
                    bsonType: ["string", "null"],
                    description: "rusher_player_id has to be string, if provided, otherwise is optional",
                },
            }
        }
    }
})

sh.shardCollection("nfl_db.games", { game_id: "hashed" });
sh.shardCollection("nfl_db.teams", { team_abbr: "hashed" });
sh.shardCollection("nfl_db.rosters", { gsis_id: "hashed" });
sh.shardCollection("nfl_db.player_stats", { player_id: "hashed" });
sh.shardCollection("nfl_db.plays", { play_id: "hashed" });