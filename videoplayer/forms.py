from django import forms

from .application import get_file_type


class VideoSourceFormMixin(object):
    """
    Form mixin for VideoSources which validates that the file type is the same
    for both source and mobile_source.

    Example implementation:

    from django import forms
    from videoplayer.forms import VideoSourceFormMixin
    from .models import VideoSource

    class VideoSourceForm(VideoSourceFormMixin, forms.ModelForm):
        model = VideoSource
    """
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
