import { handleWeather, type WeatherContext } from '../_utils/weather-service';
export const onRequest = (context: WeatherContext) => handleWeather(context);
