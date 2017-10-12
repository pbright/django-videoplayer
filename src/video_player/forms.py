from django import forms

from .application import get_file_type
from .models import VideoSource


VALID_TYPES = ('mp4', 'webm', 'ogg')
UNSUPPORTED_ERROR = \
    'Unsupported file type. Supported types: %s' % ', '.join(VALID_TYPES)


class VideoSourceForm(forms.ModelForm):
    model = VideoSource

    def clean(self):
        source = self.cleaned_data['source']
        mobile_source = self.cleaned_data['mobile_source']

        if source and mobile_source:
            source_path = getattr(source, 'url', getattr(source, 'name'))
            mobile_path = getattr(mobile_source, 'url',
                                  getattr(mobile_source, 'name'))
            if get_file_type(source_path) != get_file_type(mobile_path):
                raise forms.ValidationError('Source and Mobile Source must be '
                                            'the same type of video file.')

        return self.cleaned_data
