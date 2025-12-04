"""OpenAI image analysis"""
from typing import Literal
from server._core.llm import invoke_llm, Message

StudyType = Literal["retinal_scan", "optic_nerve", "macular_analysis"]

STUDY_TYPE_PROMPTS = {
    "retinal_scan": """Вы - опытный офтальмолог, специализирующийся на анализе рентгеновских снимков сетчатки глаза.
Проанализируйте предоставленный снимок сетчатки и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Общее описание снимка
2. Выявленные патологии или отклонения
3. Состояние сосудов сетчатки
4. Оценка макулярной области
5. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
    
    "optic_nerve": """Вы - опытный офтальмолог, специализирующийся на анализе зрительного нерва.
Проанализируйте предоставленный снимок зрительного нерва и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Оценка диска зрительного нерва
2. Состояние нейроретинального ободка
3. Соотношение экскавации и диска (C/D ratio)
4. Выявленные патологии (глаукома, атрофия и т.д.)
5. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
    
    "macular_analysis": """Вы - опытный офтальмолог, специализирующийся на анализе макулярной области.
Проанализируйте предоставленный снимок макулярной области и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Состояние фовеальной области
2. Наличие друз или пигментных изменений
3. Признаки макулярной дегенерации
4. Оценка толщины сетчатки в макулярной зоне
5. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
}


async def analyze_xray_image(image_url: str, study_type: StudyType) -> str:
    """Analyze X-ray image using LLM"""
    system_prompt = STUDY_TYPE_PROMPTS[study_type]
    
    try:
        messages: List[Message] = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Пожалуйста, проанализируйте этот рентгеновский снимок глаза и предоставьте детальное медицинское заключение.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url,
                            "detail": "high",
                        },
                    },
                ],
            },
        ]
        
        response = await invoke_llm(messages)
        
        analysis_result = response.get("choices", [{}])[0].get("message", {}).get("content")
        
        if not analysis_result or not isinstance(analysis_result, str):
            raise ValueError("No analysis result received from AI")
        
        return analysis_result
    except Exception as error:
        print(f"Error analyzing image: {error}")
        raise ValueError("Failed to analyze image with AI")

