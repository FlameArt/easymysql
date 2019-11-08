/**
 * Обёртка над БД
 */
class MySQLClass {
    
    constructor() {
        
        this.connected=false;
        
        // Создаём объект базы
        this.mysqlObject = require('mysql');
        
        /**
         * Логировать ли запросы
         * @type {boolean}
         */
        this.isLogging = true;
        
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
    connect(host,port,user,password,database) {
        
        let that = this;
        
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
        
        return new Promise(( resolve, reject ) => {
    
            // При успешном коннекте
            that.con.connect((err) => {
                
                if(err){
                    console.log('Соединение с базой НЕ установлено. Ошибка: '+err);
                    return reject(err);
                }
                
                console.log('Соединение с базой установлено');
                that.connected=true;
        
                // Запускаем таймер, который будет пинговать сервер, чтобы он не закрывал соединение
                let pingInterval = setInterval(function () {
                    try {
                        that.con.query('SELECT 1');
                    }
                    catch ($ex) {
                
                        // Ошибка соединения с базой - пересоединяемся раз в 10 секунд (чтобы не переполнять буфер)
                        setTimeout(function () {
                            if(that.con.state==='disconnected') {
                                that.connect(host,port,user,password,database)
                            }
                        },10000);
                
                    }
                }, 10000);
        
                // Выполняем коллбек
                resolve();
        
            });
    
            that.con.on('error', function(err) {
                console.log('Соединение с базой разорвано'+(err ? ". Причина: "+ err : ""));
            });
    
        });
        
    }
    
    /**
     * Получить все записи
     * @param query
     * @param params
     * @param array Массив, куда поместить результаты
     */
    all(query,params=null,array) {
        
        return new Promise(( resolve, reject )=>{
    
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
                    }
                    else {
                        FindedParams = true;
                        break;
                    }
    
            if (params !== null && (Array.isArray(params) && FindedParams===false)) {
                // Возвращаемся по коллбеку с пустым результатом сразу же
                return resolve([]);
            }
    
            if (this.connected) {
        
                let queryObj = this.con.query(query, params, function (err, result, fields) {
            
                    // Логируем запрос для отладки
                    if(that.isLogging)
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
        
            }
            else {
                resolve([]);
            }
    
        })
        
        
    }
    
    /**
     * Получить одну [первую] запись
     * @param query
     * @param params
     */
    one(query,params=null) {
    
        return new Promise(( resolve, reject )=> {
    
    
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
                    }
                    else {
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
            
                    // Есть результаты: возвращаем первый
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
      if(typeof exclude_fields === 'string')
        exclude_fields = [exclude_fields];
      
      // Если в where_update строка с одним условием, приводим к массиву
      if(typeof where_update === 'string')
        where_update = [where_update];
  
      // Если массив пустой - возвращаем мгновенный промис
      if (values.length === 0) return new Promise((resolve, reject) => {
        resolve();
      });
  
      // один bulk insert запрос для всех новых позиций в этой таблице
      let insert_query = "INSERT IGNORE INTO " + table + "(";
      let update_query = " ON DUPLICATE KEY UPDATE ";
  
  
      // Сперва проходимся по всем значениям и создаём список всех уникальных полей с доступом по номеру
      let Fields = [];
      values.forEach(item=> {
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
          if(where_update.length === 0)
            update_query += that.escapeID(Fields[i]) + '=' + ' VALUES(' + that.escapeID(Fields[i]) + "),";
          else {
            
            // Нужно обновлять только отдельные строки по условию
            update_query += that.escapeID(Fields[i]) + '=' +  "IF(";
            for (let whereItem of where_update) {
              update_query += whereItem + " AND ";
            }
            
            // Удаляем последний AND
            update_query = update_query.substr(0,update_query.length-5);
            
            // Добавляем условие в каждое поле, что если оно выполняется - заполняем новыми значениями из VALUES, а если нет - старым из оригинального поля
            update_query += ", VALUES("+ that.escapeID(Fields[i]) + "), " + that.escapeID(Fields[i]) + "),";
            
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
          if(item.hasOwnProperty(Fields[i])) {
            
            // Если значение массивное или объектное - преобразуем в JSON
            if(typeof item[Fields[i]] === 'object')
              tvalue = JSON.stringify(item[Fields[i]]);
            else
              tvalue = item[Fields[i]];
            
            // Добавляем значение
            insert_query += that.escape(tvalue) + ","; // вставляем значение
  
          }
          else {
  
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
     *
     * @param str
     */
    escape (str) {
        return this.con.escape(str);
    }
    
    /**
     * Строк
     * @param str
     */
    escapeID (str) {
        return this.con.escapeId(str);
    }
  
  /**
   * Получить все записи из таблицы
   * @param table
   * @param where
   * @param whereparams
   * @return Promise<array|null>
   */
  selectAll(table, where = "", whereparams = null) {
    if(where==='')
      return this.all("SELECT * FROM " + this.escapeID(table));
    else
      return this.all("SELECT * FROM " + this.escapeID(table) + " WHERE " + where, whereparams );
  }
  
  /**
   * Получить конкретную запись из таблицы
   * @param table
   * @param where
   * @param whereparams
   * @return Promise
   */
  get(table, where = "", whereparams = null) {
    if(where==='')
      return this.one("SELECT * FROM " + this.escapeID(table));
    else
      return this.one("SELECT * FROM " + this.escapeID(table) + " WHERE " + where, whereparams );
  }
  
}

module.exports = MySQLClass;