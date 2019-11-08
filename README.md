# Easy MySQL requests

Promise based, easy and fast methods for MySQL requests.

    npm install --save FlameArt/easymysql

## Usage

```
const SQL = new (require('easymysql'));

// Wait for connecting
await SQL.connect(host, port, user, password, database_name);

// Fast syntax
let all_rows = await SQL.get('table_name');
let one_row = await SQL.get('table_name', "name=? AND id>?", ['unesca"pe%d param', 5]);

// Raw requests
let custom_one_row = await SQL.one("SELECT * FROM users WHERE name=?", ['unesca"ped param']);
let custom_all_rows = await SQL.all("SELECT * FROM users WHERE id>?", [5]);
```

### Bulk insert and update

All rows insert or update in one query, thats extremly fast.
Method accepts array of rows to insert or update.
**Main feature:** you can set unique\primary column like a `id` and row will be updated instead of insert.
Also, you can write update condition in last parameter

```
let rows = [
    {
        name: 'Bob',
        sex: 1
    },
    {
        name: 'Kate',
        sex: 2,
        // That field will be serialized
        categories: [
            'cats lover',
            'hello kitty'
        ]
    },
    // That will be updated, instead of insert
    // Missed field 'categories' will be filled by default mysql value
    {
        id: 177,
        name: 'Potter',
        sex: 1
    },
];

// Insert all non-unique rows, and update other only if column type=3
await SQL.BulkUpdate('table_name', rows, ['not_update_these_field'], 'type=3']);

// or just
await SQL.BulkUpdate('table_name', rows);

```

That is very convenient, if you get columns add or update some in array and save again:

```
let rows = await SQL.selectAll('users');

rows[177].name = 'Harry Potter';
rows.push({name: 'Adam', sex: 1});

await SQL.BulkUpdate('users', rows);
```

One row will be inserted and one will be updated. Missed columns fill with default (mysql) values.

*Good practice* is use unique fields in mysql

###### BULK REQUEST

`BulkUpdate` generate the request:

    INSERT IGNORE INTO table(columns...) VALUES (row1col1,row1col2, ...), (row2col1,row2col2,...) ON DUPLICATE KEY UPDATE updated_field=IF(update_condition, value, old_value), ...
    
* with default values for missed columns
* with serialization for objects

# License
MIT