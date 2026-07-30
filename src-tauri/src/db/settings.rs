use crate::db::models::{NewSetting, SettingRow, SettingUpdate};
use crate::db::{get_pool, schema::settings};
use crate::errors::AppError;
use diesel::OptionalExtension;
use diesel::prelude::*;
use std::collections::HashMap;

pub fn get(key: &str) -> Result<Option<String>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    settings::table
        .find(key)
        .select(settings::value)
        .first::<String>(&mut conn)
        .optional()
        .map_err(AppError::from)
}

pub fn set(key: &str, value: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let exists = settings::table.find(key).first::<SettingRow>(&mut conn).optional()?;
    if exists.is_some() {
        diesel::update(settings::table.find(key))
            .set(SettingUpdate {
                value: value.to_string(),
            })
            .execute(&mut conn)?;
    } else {
        diesel::insert_into(settings::table)
            .values(&NewSetting {
                key: key.to_string(),
                value: value.to_string(),
            })
            .execute(&mut conn)?;
    }
    Ok(())
}

pub fn get_all() -> Result<HashMap<String, String>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let rows = settings::table
        .select((settings::key, settings::value))
        .load::<(String, String)>(&mut conn)
        .map_err(AppError::from)?;
    Ok(rows.into_iter().collect())
}

#[allow(dead_code)]
pub fn delete(key: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::delete(settings::table.find(key)).execute(&mut conn)?;
    Ok(())
}
