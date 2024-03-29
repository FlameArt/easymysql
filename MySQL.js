/**
 * Обёртка над БД
 */
class MySQLClass {

    constructor() {

        this.connected = false;

        // Создаём объект базы
        this.mysqlObject = require('mysql');

        /**
         * Логировать ли запросы
         * @type {boolean}
         */
        this.isLogging = true;

        /**
         * Выводить ли ошибки инсертов или скрывать через insert ignore
         * Нужно знать
         * @type {boolean}
         */
        this.DisableInsertIgnore = false;

    }

    /**
     * Соединится с базой и вернуть промис
     * @param host
     * @param port
     * @param user
     * @param password
     * @param database
     * @return {Promise}
     */
    connect(host, port, user, password, database) {

        let that = this;

        // пустой промис если соединение уже есть
        if(that.connected) return new Promise(res=>{res()});

        // Делаем коннект с базой
        that.con = this.mysqlObject.createConnection({
            host: host,
            port: port,
            user: user,
            password: password,
            database: database,
            multipleStatements: true,
            charset: 'utf8mb4_general_ci'
        });

        return new Promise((resolve, reject) => {

            // При успешном коннекте
            that.con.connect((err) => {

                if (err) {
                    console.log('Соединение с базой НЕ установлено. Ошибка: ' + err);
                    return reject(err);
                }

                console.log('Соединение с базой установлено');
                that.connected = true;

                // Запускаем таймер, который будет пинговать сервер, чтобы он не закрывал соединение
                that.pingInterval = setInterval(function () {
                    try {
                        that.con.query('SELECT 1');
                    } catch ($ex) {

                        // Ошибка соединения с базой - пересоединяемся раз в 10 секунд (чтобы не переполнять буфер)
                        setTimeout(function () {
                            if (that.con.state === 'disconnected') {
                                that.connect(host, port, user, password, database)
                            }
                        }, 10000);

                    }
                }, 10000);

                // Выполняем коллбек
                resolve();

            });

            that.con.on('error', function (err) {
                console.log('Соединение с базой разорвано' + (err ? ". Причина: " + err : ""));
            });

        });

    }

    disconnect() {
        let that = this;
        return new Promise((resolve, reject)=>{
            that.con.end(function (err){

              // TODO: errors

              clearInterval(that.pingInterval);
              that.connected = false;
              resolve(true);

            })
        })
    }

    /**
     * Получить все записи
     * @param query
     * @param params
     * @param array Массив, куда поместить результаты
     */
    all(query, params = null, array) {

        return new Promise((resolve, reject) => {

            // Если параметры должны были быть переданы, то они будут отличными от null
            // И если они должны были быть переданы, но по итогу передан пустой массив,
            // значит поиск не нужен, и мы должны вернуть управление сразу же
            let FindedParams = false;
            let that = this;
            if (Array.isArray(params))
                for (let i = 0; i < params.length; i++)
                    if (Array.isArray(params[i])) {
                        if (params[i].length > 0) {
                            FindedParams = true;
                            break;
                        }
                    } else {
                        FindedParams = true;
                        break;
                    }

            if (params !== null && (Array.isArray(params) && FindedParams === false)) {
                // Возвращаемся по коллбеку с пустым результатом сразу же
                return resolve([]);
            }

            if (this.connected) {

                let queryObj = this.con.query(query, params, function (err, result, fields) {

                    // Логируем запрос для отладки
                    if (that.isLogging)
                        console.log(queryObj.sql);

                    if (err) {
                        console.log('Ошибка в запросе: ' + err.message);
                        return resolve([]);
                    }

                    // Нет результатов
                    if (result.length === 0) {
                        return resolve([]);
                    }

                    // Есть результаты

                    // Если надо сразу отправить в массив, делаем это
                    if (array !== null && array !== undefined) {

                        // перебираем записи
                        for (let i = 0; i < result.length; i++) {

                            let newItem = {};

                            // перебираем поля
                            for (let column in result[i]) {
                                if (result[i].hasOwnProperty(column)) {
                                    newItem[column] = result[i][column];
                                }
                            }

                            // Добавляем в массив
                            array.push(newItem);

                        }
                    }

                    // Вызываем коллбек с результатами
                    resolve(result);

                });

            } else {
                resolve([]);
            }

        })


    }

    /**
     * Получить одну [первую] запись
     * @param query
     * @param params
     */
    one(query, params = null) {

        return new Promise((resolve, reject) => {


            // Если параметры должны были быть переданы, то они будут отличными от null
            // И если они должны были быть переданы, но по итогу передан пустой массив,
            // значит поиск не нужен, и мы должны вернуть управление сразу же
            let FindedParams = false;
            let that = this;
            if (Array.isArray(params))
                for (let i = 0; i < params.length; i++)
                    if (Array.isArray(params[i])) {
                        if (params[i].length > 0) {
                            FindedParams = true;
                            break;
                        }
                    } else {
                        FindedParams = true;
                        break;
                    }

            if (params !== null && (Array.isArray(params) && FindedParams === false)) {
                // Возвращаемся по коллбеку с пустым результатом сразу же
                return resolve(null);
            }

            if (this.connected) {

                let queryObj = this.con.query(query, params, function (err, result, fields) {

                    // для дебага логируем
                    if (that.isLogging)
                        console.log(queryObj.sql);

                    if (err) {
                        console.log('Ошибка в запросе: ' + err.message);
                        console.log('Запрос: ' + query);
                        return resolve(false, null);
                    }

                    // Нет результатов
                    if (result.length === 0) {
                        return resolve(null, null);
                    }

                    // Возвращаем номер вставленной строки, если результатов нет, а номер есть
                    if(result[0]===undefined && result.insertId!==undefined)
                        return resolve(result.insertId);
                    else
                        // Возвращаем первый результат, если результаты есть
                        return resolve(result[0], result);

                });

            }

        });

    }

    /**
     * Обновить массив значений за 1 запрос
     * Все новые записи будут вставлены 1 запросом, для этого держите KeyField в значении null или undefined, т.е. можно их не назначать
     * @param table Название таблицы
     * @param values Массив значений, которые надо обновить
     * @param exclude_fields Поля, которые не надо обновлять из тех, что есть  в массиве
     * @param where_update {Array|string} Если поле уже существует, то обновлять только отдельные записи
     * Формат: []
     * @return Promise
     * @constructor
     */
    BulkUpdate(table, values, exclude_fields = ['id'], where_update = []) {

        let that = this;

        // Если в exclude fields указана строка, то приводим её к списку полей
        if (typeof exclude_fields === 'string')
            exclude_fields = [exclude_fields];

        // Если в where_update строка с одним условием, приводим к массиву
        if (typeof where_update === 'string')
            where_update = [where_update];

        // Если массив пустой - возвращаем мгновенный промис
        if (values.length === 0) return new Promise((resolve, reject) => {
            resolve();
        });

        // один bulk insert запрос для всех новых позиций в этой таблице
        let insert_query = "INSERT " + (that.DisableInsertIgnore ? '' : 'IGNORE') + " INTO " + table + "(";
        let update_query = " ON DUPLICATE KEY UPDATE ";

        // Сперва проходимся по всем значениям и создаём список всех уникальных полей с доступом по номеру
        let Fields = [];
        values.forEach(item => {
            for (let name in item)

                // Добавляем в список полей
                if (!Fields.includes(name)) {

                    Fields.push(name);

                    // Вставляем в шаблон
                    insert_query += that.escapeID(name) + ",";

                }

        });

        // Завершаем шаблон запроса
        insert_query = insert_query.substr(0, insert_query.length - 1) + ") VALUES ";// убираем запятую и заканчиваем левую часть запроса
        let base_insert_query_length = insert_query.length; // если длина изменится, значит есть insert запросы
        let base_fields_count = Object.keys(values[0]).length;

        // Создаём вторую часть запроса - обновления
        for (let i = 0; i < Fields.length; i++) {
            if (!exclude_fields.includes(Fields[i])) { // не обновляем не нужные поля
                // Если нет условий обновления строки - обновляем все строки
                if (where_update.length === 0)
                    update_query += that.escapeID(Fields[i]) + '=' + ' VALUES(' + that.escapeID(Fields[i]) + "),";
                else {

                    // Нужно обновлять только отдельные строки по условию
                    update_query += that.escapeID(Fields[i]) + '=' + "IF(";
                    for (let whereItem of where_update) {
                        update_query += whereItem + " AND ";
                    }

                    // Удаляем последний AND
                    update_query = update_query.substr(0, update_query.length - 5);

                    // Добавляем условие в каждое поле, что если оно выполняется - заполняем новыми значениями из VALUES, а если нет - старым из оригинального поля
                    update_query += ", VALUES(" + that.escapeID(Fields[i]) + "), " + that.escapeID(Fields[i]) + "),";

                }

            }
        }

        let queries = "", tvalue = "";
        values.forEach(function (item) {

            // Если у объекта нет полей, то пропускаем его
            if (Object.keys(item).length === 0) return;

            // Вставляем новую скобку
            insert_query += "(";

            // Вставляем значения по их порядку
            for (let i = 0; i < Fields.length; i++) {

                // Поле существует в текущем объекте?
                if (item.hasOwnProperty(Fields[i])) {

                    // Если значение массивное или объектное - преобразуем в JSON
                    if (typeof item[Fields[i]] === 'object')
                        tvalue = JSON.stringify(item[Fields[i]]);
                    else
                        tvalue = item[Fields[i]];

                    // Добавляем значение
                    insert_query += that.escape(tvalue) + ","; // вставляем значение

                } else {

                    // Поле пропущено: вставляем стандартное значение для этого поля
                    insert_query += 'DEFAULT' + ",";

                }

            }

            // убираем запятую и заканчиваем блок этой записи
            insert_query = insert_query.substr(0, insert_query.length - 1) + "),";

            if (item === undefined) {
                debugger;
            }

        });


        // Убираем последнюю запятую
        insert_query = insert_query.substr(0, insert_query.length - 1);
        update_query = update_query.substr(0, update_query.length - 1);


        // Соединяем правую и левую часть запроса
        queries = insert_query + " " + update_query;

        // Делаем запрос и возвращаем его промис
        return that.one(queries);

    }

    /**
     * Вставить одну запись и вернуть её ID
     * @param table
     * @param data
     * @returns {Promise}
     */
    insertOne(table, data) {

        let columns = [], rows = [];
        for (const column in data) {columns.push(this.escapeID(column)); rows.push(this.escape(data[column]))}
        let query = "INSERT INTO " + this.escapeID(table) + "(" + columns.join(",") + ") VALUES (" + rows.join(",") + ")";

        return this.one(query);

    }

    /**
     * Обновить одну запись и вернуть её ID
     * @param table
     * @param data только те поля, что нуждаются в обновлении
     * @param id конкретный айди для обновления
     * @param where
     * @returns {Promise}
     */
    updateOne(table, data, id = null, where = null) {

        let query = "UPDATE " + this.escapeID(table) + " SET "
        for (const column in data)
            query += this.escapeID(column) + "=" + this.escape(data[column]) + ",";

        query = query.substr(0,query.length-1);

        let whereFilter = "";
        if(id !== null) whereFilter = " WHERE `id`=" + this.escape(id) + " LIMIT 1";
        if(where !== null) whereFilter = " WHERE " + where;

        // Если не указано ни одного условия - для безопасности возвращаем false, чтобы кодер задумался в чём проблема и если надо просто бы сделал where=true
        if(whereFilter === "") return false;

        return this.one(query + whereFilter);

    }

    /**
     *
     * @param str
     */
    escape(str) {
        return this.con.escape(str);
    }

    /**
     * Строк
     * @param str
     */
    escapeID(str) {
        return this.con.escapeId(str);
    }

    /**
     * Получить все записи из таблицы
     * @param tables
     * @param where
     * @param whereparams
     * @param {string} orderBy
     * @return Promise<array|null>
     */
    selectAll(tables, where = "", whereparams = null, orderBy = null) {

        // Нормализуем несколько таблиц, если они есть
        let that = this;
        tables = tables.split(',');
        let normTables = tables.map(res => that.escapeID(res)).join(",");

        // сортировка
        let orderByQuery = "";
        if(orderBy!==null) {
            orderByQuery = " ORDER BY " + orderBy
            //orderBy = orderBy.split(',');
            //orderByQuery = orderBy.map(res => that.escapeID(res)).join(",");
        }


        if (where === '')
            return this.all("SELECT * FROM " + normTables + orderByQuery);
        else
            return this.all("SELECT * FROM " + normTables + " WHERE " + where + orderByQuery, whereparams);

    }

    /**
     * Получить конкретную запись из таблицы
     * @param tables
     * @param where
     * @param whereparams
     * @param {string} orderBy
     * @return Promise
     */
    get(tables, where = "", whereparams = null, orderBy = null) {

        // Нормализуем несколько таблиц, если они есть
        let that = this;
        tables = tables.split(',');
        let normTables = tables.map(res => that.escapeID(res)).join(",");

        // сортировка
        let orderByQuery = "";
        if(orderBy!==null) {
            orderByQuery = " ORDER BY " + orderBy
            //orderBy = orderBy.split(',');
            //orderByQuery = orderBy.map(res => that.escapeID(res)).join(",");
        }

        if (where === '')
            return this.one("SELECT * FROM " + normTables + orderByQuery + " LIMIT 1");
        else
            return this.one("SELECT * FROM " + normTables + " WHERE " + where + orderByQuery + " LIMIT 1", whereparams);

    }

}

module.exports = MySQLClass;
